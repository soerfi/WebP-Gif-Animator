import React, { useCallback, useState } from 'react';
import { Upload, Image as ImageIcon, Plus } from 'lucide-react';

interface UploadZoneProps {
  onFileSelect: (files: File[]) => void;
  className?: string;
  isCompact?: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onFileSelect, className = '', isCompact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    // 1. Check for files (standard drag from desktop or some browsers)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
      if (files.length > 0) {
        onFileSelect(files);
        return;
      }
    }

    // 2. Extract Data directly (More reliable for Cross-Browser Drag & Drop)
    const uri = e.dataTransfer.getData('text/uri-list');
    const text = e.dataTransfer.getData('text/plain');
    const html = e.dataTransfer.getData('text/html');
    
    let imageUrl = '';

    // Priority 1: URI List
    if (uri) {
        // Sometimes uri-list contains multiple, split by newline
        const firstUri = uri.split('\n')[0].trim();
        if (firstUri && (firstUri.match(/^https?:\/\/.*(jpeg|jpg|png|webp|gif)/i) || firstUri.startsWith('data:image'))) {
             imageUrl = firstUri;
        }
    }

    // Priority 2: Text/Plain (Chrome often puts URL here)
    if (!imageUrl && text) {
        if (text.match(/^https?:\/\/.*(jpeg|jpg|png|webp|gif)/i) || text.startsWith('data:image')) {
            imageUrl = text;
        }
    }

    // Priority 3: Parse HTML for img src (Fallback)
    if (!imageUrl && html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const img = doc.querySelector('img');
        if (img && img.src) {
            imageUrl = img.src;
        }
    }

    if (imageUrl) {
        setIsFetching(true);
        try {
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            const blob = await response.blob();
            // Create a file from the blob
            const fileName = `dragged-image-${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`;
            const file = new File([blob], fileName, { type: blob.type });
            onFileSelect([file]);
        } catch (err) {
            console.error("Failed to fetch dropped image URL:", err);
            alert("Could not load image from external URL due to browser security restrictions (CORS). Please save the image to your desktop and drag the file instead.");
        } finally {
            setIsFetching(false);
        }
    }

  }, [onFileSelect]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
        const files = Array.from(e.clipboardData.files).filter((f) => (f as File).type.startsWith('image/')) as File[];
        if (files.length > 0) {
            e.preventDefault();
            onFileSelect(files);
        }
    }
  }, [onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFileSelect(files);
    }
    // Reset value so same file can be selected again if needed
    e.target.value = '';
  }, [onFileSelect]);

  if (isCompact) {
     return (
        <div 
          className={`relative border border-dashed border-slate-300 rounded-xl hover:bg-slate-50 transition-colors flex flex-col items-center justify-center p-4 cursor-pointer group outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${className}`}
          tabIndex={0}
          onPaste={handlePaste}
        >
           <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            aria-label="Upload more images"
          />
          <div className="bg-slate-100 text-slate-500 rounded-full p-2 mb-2 group-hover:text-blue-600 group-hover:bg-blue-50">
             <Plus size={20} />
          </div>
          <span className="text-xs font-medium text-slate-500">Add Image (or Paste)</span>
        </div>
     )
  }

  return (
    <div 
      className={`
        relative border-2 border-dashed rounded-2xl transition-all duration-200 ease-in-out
        flex flex-col items-center justify-center p-12 text-center group outline-none focus:ring-4 focus:ring-blue-100
        ${isDragging 
          ? 'border-blue-500 bg-blue-50 scale-[1.02]' 
          : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        aria-label="Upload images"
      />
      
      <div className={`
        p-4 rounded-full mb-4 transition-colors
        ${isDragging ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'}
      `}>
        {isDragging ? <Upload size={32} /> : (isFetching ? <div className="animate-spin"><Plus size={32}/></div> : <ImageIcon size={32} />)}
      </div>
      
      <h3 className="text-xl font-semibold text-slate-900 mb-2">
        {isDragging ? 'Drop them here!' : (isFetching ? 'Fetching image...' : 'Upload Product Photos')}
      </h3>
      <p className="text-slate-500 max-w-xs mx-auto">
        Drag & drop, paste from clipboard, or click to browse.
        <br />
        <span className="text-xs mt-2 block opacity-70">JPG, PNG, WEBP supported</span>
      </p>
    </div>
  );
};