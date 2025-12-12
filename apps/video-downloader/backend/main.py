import os
import shutil
import uuid
import subprocess
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks, File, UploadFile
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
        # Configure yt-dlp with more robust options
        ydl_opts = {
            'outtmpl': os.path.join(work_dir, '%(title)s.%(ext)s'),
            'quiet': False,
            'no_warnings': False,
            'nocheckcertificate': True,
            'ignoreerrors': False, # We want to catch errors
            'logtostderr': True,
            'source_address': '0.0.0.0', # Force IPv4
            # User agent to avoid bot detection
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            # YouTube-specific extractor args to bypass bot detection
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],
                    'player_skip': ['webpage', 'configs'],
                }
            },
        }

        # Add cookies if available
        cookies_file = '/app/backend/cookies.txt'
        if os.path.exists(cookies_file):
            ydl_opts['cookiefile'] = cookies_file
            print(f"Using cookies from {cookies_file}")

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
            # More flexible format selection with multiple fallbacks
            ydl_opts.update({
                'format': 'bv*+ba/b',  # Best video + best audio, or best single file
                'merge_output_format': 'mp4',  # Merge to mp4 if needed
            })


        print(f"Downloading URL: {req.url} with options: {ydl_opts}")

        # Download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(req.url, download=True)
            filename = ydl.prepare_filename(info)
            
            if req.format == 'audio':
                # yt-dlp changes extension to mp3
                filename = os.path.splitext(filename)[0] + '.mp3'

        print(f"Expected filename: {filename}")

        # Find the actual downloaded file (might have different name)
        # List all files in the work directory
        downloaded_files = [f for f in os.listdir(work_dir) if os.path.isfile(os.path.join(work_dir, f))]
        print(f"Files in work directory: {downloaded_files}")

        if not downloaded_files:
            raise HTTPException(status_code=500, detail="No file was downloaded")

        # Use the first (and should be only) file
        actual_filename = os.path.join(work_dir, downloaded_files[0])
        print(f"Using file: {actual_filename}")

        if not os.path.exists(actual_filename):
            raise HTTPException(status_code=500, detail=f"File not found: {actual_filename}")

        final_file = actual_filename

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
        import traceback
        traceback.print_exc()
        print(f"Error processing request: {e}")
        cleanup_file(work_dir)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/upload-cookies")
async def upload_cookies(file: UploadFile = File(...)):
    """Upload cookies.txt file for authentication"""
    cookies_path = "/app/backend/cookies.txt"
    try:
        contents = await file.read()
        with open(cookies_path, 'wb') as f:
            f.write(contents)
        print(f"Cookies uploaded successfully to {cookies_path}")
        return {"message": "Cookies uploaded successfully", "filename": file.filename}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok"}


# --- Shared Styles API ---

STYLES_DIR = "/app/data/styles"
os.makedirs(STYLES_DIR, exist_ok=True)

class Style(BaseModel):
    id: str
    name: str
    prompt: str
    imageUrl: str  # Relative URL or Base64 (we'll store as file and serve url)
    timestamp: int

@app.get("/styles/")
def list_styles():
    styles = []
    if not os.path.exists(STYLES_DIR):
        return []
    
    for filename in os.listdir(STYLES_DIR):
        if filename.endswith(".json"):
            try:
                import json
                with open(os.path.join(STYLES_DIR, filename), 'r') as f:
                    styles.append(json.load(f))
            except Exception as e:
                print(f"Error reading style {filename}: {e}")
    
    # Sort by timestamp desc
    return sorted(styles, key=lambda x: x.get('timestamp', 0), reverse=True)

class PublishStyleRequest(BaseModel):
    name: str
    prompt: str
    imageData: str # Base64

@app.post("/styles/")
def publish_style(req: PublishStyleRequest):
    try:
        import time
        import base64
        import json

        style_id = str(uuid.uuid4())
        
        # Save Image
        image_filename = f"{style_id}.png"
        image_path = os.path.join(STYLES_DIR, image_filename)
        
        # Simple Base64 decode
        if "," in req.imageData:
            header, encoded = req.imageData.split(",", 1)
        else:
            encoded = req.imageData
            
        with open(image_path, "wb") as f:
            f.write(base64.b64decode(encoded))
            
        # Save Metadata
        style_data = {
            "id": style_id,
            "name": req.name,
            "prompt": req.prompt,
            "imageUrl": f"/api/styles/image/{image_filename}",
            "timestamp": int(time.time() * 1000)
        }
        
        json_path = os.path.join(STYLES_DIR, f"{style_id}.json")
        with open(json_path, "w") as f:
            json.dump(style_data, f)
            
        return style_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/styles/{style_id}")
def delete_style(style_id: str):
    json_path = os.path.join(STYLES_DIR, f"{style_id}.json")
    image_path = os.path.join(STYLES_DIR, f"{style_id}.png")
    
    if os.path.exists(json_path):
        os.remove(json_path)
    if os.path.exists(image_path):
        os.remove(image_path)
        
    return {"status": "deleted"}

@app.get("/styles/image/{filename}")
def get_style_image(filename: str):
    file_path = os.path.join(STYLES_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)


# --- Shared Prompts API ---

PROMPTS_DIR = "/app/data/prompts"
os.makedirs(PROMPTS_DIR, exist_ok=True)

class Prompt(BaseModel):
    id: str
    name: str
    text: str
    timestamp: int

@app.get("/prompts/")
def list_prompts():
    prompts = []
    if not os.path.exists(PROMPTS_DIR):
        return []
    
    for filename in os.listdir(PROMPTS_DIR):
        if filename.endswith(".json"):
            try:
                import json
                with open(os.path.join(PROMPTS_DIR, filename), 'r') as f:
                    prompts.append(json.load(f))
            except Exception as e:
                print(f"Error reading prompt {filename}: {e}")
    
    # Sort by timestamp desc
    return sorted(prompts, key=lambda x: x.get('timestamp', 0), reverse=True)

class PublishPromptRequest(BaseModel):
    name: str
    text: str

@app.post("/prompts/")
def publish_prompt(req: PublishPromptRequest):
    try:
        import time
        import json
        
        prompt_id = str(uuid.uuid4())
        
        # Save Metadata
        prompt_data = {
            "id": prompt_id,
            "name": req.name,
            "text": req.text,
            "timestamp": int(time.time() * 1000)
        }
        
        json_path = os.path.join(PROMPTS_DIR, f"{prompt_id}.json")
        with open(json_path, "w") as f:
            json.dump(prompt_data, f)
            
        return prompt_data
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/prompts/{prompt_id}")
def delete_prompt(prompt_id: str):
    json_path = os.path.join(PROMPTS_DIR, f"{prompt_id}.json")
    
    if os.path.exists(json_path):
        os.remove(json_path)
        
    return {"status": "deleted"}
