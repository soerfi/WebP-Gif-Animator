import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, Link, Music, Video, Scissors, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import './App.css'

function App() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  const [showCrop, setShowCrop] = useState(false)
  const [cropStart, setCropStart] = useState('')
  const [cropEnd, setCropEnd] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [cookieFile, setCookieFile] = useState<File | null>(null)
  const [uploadingCookies, setUploadingCookies] = useState(false)

  const handleDownload = async (e: FormEvent) => {
    e.preventDefault()
    if (!url) return

    setLoading(true)
    setStatus(null)

    try {
      const response = await fetch('/api/video-downloader/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          format,
          crop_start: showCrop ? cropStart : null,
          crop_end: showCrop ? cropEnd : null
        })
      })

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json()
          throw new Error(error.detail || 'Download failed')
        } else {
          const text = await response.text();
          console.error("Server Error Response:", text);
          throw new Error(`Server error: ${response.status} ${response.statusText}`);
        }
      }

      // Handle file download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      // Try to get filename from headers or default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = 'download'
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/)
        if (match) filename = match[1]
      }
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)

      setStatus({ type: 'success', message: 'Download started!' })
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  const handleCookieUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingCookies(true)
    setStatus(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/video-downloader/upload-cookies', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to upload cookies')
      }

      setCookieFile(file)
      setStatus({ type: 'success', message: 'Cookies uploaded! You can now download from YouTube, Instagram, etc.' })
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setUploadingCookies(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start p-4 pt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-lg shadow-purple-500/30"
          >
            <Download className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
            Video Downloader
          </h1>
          <p className="text-gray-400">
            Download videos from YouTube, Vimeo, Instagram & more
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success'
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
            >
              {status.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="flex-1">{status.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step 1: Cookie Authentication (Optional) */}
        <div className="card backdrop-blur-xl bg-opacity-50 border-gray-800 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <span className="text-yellow-400 font-bold">!</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Optional: Upload Cookies</h3>
              <p className="text-sm text-gray-400 mb-3">
                YouTube, Instagram & Vimeo require authentication. Upload your browser cookies to enable downloads from these sites.
              </p>
              {cookieFile && (
                <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">Cookies loaded: {cookieFile.name}</span>
                </div>
              )}
              <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all ${cookieFile
                ? 'bg-gray-700 hover:bg-gray-600 text-white'
                : 'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-500 hover:to-orange-500 text-white'
                }`}>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleCookieUpload}
                  className="hidden"
                  disabled={uploadingCookies}
                />
                {uploadingCookies ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    {cookieFile ? 'Update Cookies' : 'Choose cookies.txt'}
                  </>
                )}
              </label>
              {!cookieFile && (
                <p className="text-xs text-gray-500 mt-2">
                  Need help? <a href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Learn how to export cookies</a>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Main Download Section */}
        <div className="card backdrop-blur-xl bg-opacity-50 border-gray-800">
          <form onSubmit={handleDownload} className="space-y-6">
            {/* Step 1: URL Input */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">1</div>
                Paste Video URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Link className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full pl-12 pr-4 py-4 bg-black/30 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-white placeholder-gray-500"
                  required
                />
              </div>
            </div>

            {/* Step 2: Format Selection */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">2</div>
                Choose Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormat('video')}
                  className={`flex items-center justify-center gap-3 py-4 px-4 rounded-xl transition-all border-2 ${format === 'video'
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                >
                  <Video className="w-5 h-5" />
                  <span className="font-medium">Video (MP4)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('audio')}
                  className={`flex items-center justify-center gap-3 py-4 px-4 rounded-xl transition-all border-2 ${format === 'audio'
                    ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                    }`}
                >
                  <Music className="w-5 h-5" />
                  <span className="font-medium">Audio (MP3)</span>
                </button>
              </div>
            </div>

            {/* Step 3: Advanced Options */}
            <div>
              <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">3</div>
                Advanced Options (Optional)
              </label>
              <button
                type="button"
                onClick={() => setShowCrop(!showCrop)}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border ${showCrop
                  ? 'bg-gray-700 border-gray-600 text-white'
                  : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
              >
                <span className="flex items-center gap-2">
                  <Scissors className="w-4 h-4" />
                  Trim Video
                </span>
                <span className="text-sm">{showCrop ? '▼' : '▶'}</span>
              </button>

              <AnimatePresence>
                {showCrop && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-3"
                  >
                    <div className="grid grid-cols-2 gap-3 p-4 bg-black/20 rounded-xl border border-gray-800">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Start Time</label>
                        <input
                          type="text"
                          placeholder="00:00:00"
                          value={cropStart}
                          onChange={(e) => setCropStart(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg text-white py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">End Time</label>
                        <input
                          type="text"
                          placeholder="00:00:00"
                          value={cropEnd}
                          onChange={(e) => setCropEnd(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded-lg text-white py-2 px-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-gray-500">Format: HH:MM:SS (e.g., 00:01:30 for 1 minute 30 seconds)</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Download Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-lg rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-6 h-6" />
                  Download Now
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Supports YouTube, Vimeo, Instagram, Facebook, Twitter and many more platforms</p>
        </div>
      </motion.div>
    </div>
  )
}

export default App
