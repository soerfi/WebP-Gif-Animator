import os
import shutil
import uuid
import subprocess
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
import yt_dlp

app = FastAPI()

class DownloadRequest(BaseModel):
    url: str
    format: str = "video"  # video or audio
    crop_start: Optional[str] = None
    crop_end: Optional[str] = None

TEMP_DIR = "/tmp/video-downloader"
os.makedirs(TEMP_DIR, exist_ok=True)

def cleanup_file(path: str):
    if os.path.exists(path):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
        except Exception as e:
            print(f"Error cleaning up {path}: {e}")

@app.post("/download")
async def download_video(req: DownloadRequest, background_tasks: BackgroundTasks):
    # Create a unique directory for this request to avoid collisions
    request_id = str(uuid.uuid4())
    work_dir = os.path.join(TEMP_DIR, request_id)
    os.makedirs(work_dir, exist_ok=True)

    try:
        # Configure yt-dlp
        ydl_opts = {
            'outtmpl': os.path.join(work_dir, '%(title)s.%(ext)s'),
            'quiet': True,
        }

        if req.format == 'audio':
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
        else:
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            })

        # Download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=True)
            filename = ydl.prepare_filename(info)
            
            if req.format == 'audio':
                # yt-dlp changes extension to mp3
                filename = os.path.splitext(filename)[0] + '.mp3'

        if not os.path.exists(filename):
            raise HTTPException(status_code=500, detail="Download failed")

        final_file = filename

        # Crop if requested
        if req.crop_start or req.crop_end:
            cropped_file = os.path.join(work_dir, f"cropped_{os.path.basename(filename)}")
            
            cmd = ['ffmpeg', '-y']
            if req.crop_start:
                cmd.extend(['-ss', req.crop_start])
            if req.crop_end:
                cmd.extend(['-to', req.crop_end])
            
            cmd.extend(['-i', filename])
            
            # Re-encode to ensure accurate cutting, or copy for speed?
            # Copy is faster but might be inaccurate at keyframes.
            # Let's try copy first, if issues arise we can re-encode.
            # Actually, for web usage, re-encoding is safer for compatibility.
            # But it's slow. Let's use stream copy if possible, but -ss before -i is fast seek.
            # If we use -c copy, it might be inaccurate.
            # Let's use default encoding (libx264) for video, libmp3lame for audio.
            
            if req.format == 'audio':
                cmd.extend(['-c:a', 'libmp3lame'])
            else:
                cmd.extend(['-c:v', 'libx264', '-c:a', 'aac'])
                
            cmd.append(cropped_file)
            
            subprocess.run(cmd, check=True)
            final_file = cropped_file

        # Schedule cleanup
        background_tasks.add_task(cleanup_file, work_dir)

        return FileResponse(
            final_file, 
            filename=os.path.basename(final_file),
            media_type='audio/mpeg' if req.format == 'audio' else 'video/mp4'
        )

    except Exception as e:
        cleanup_file(work_dir)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}
