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
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-6 shadow-lg shadow-purple-500/30"
          >
            <Download className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-4">
            Video Downloader
          </h1>
          <p className="text-gray-400 text-lg">
            Download from YouTube, Vimeo, Instagram & more
          </p>
        </div>

        {/* Cookie Upload Section */}
        <div className="card backdrop-blur-xl bg-opacity-50 border-gray-800 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
              <p className="text-sm text-gray-400 mb-4">
                YouTube, Instagram & Vimeo require cookies.
                {cookieFile && <span className="text-green-400"> ✓ Cookies loaded: {cookieFile.name}</span>}
              </p>
              <label className="relative inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg cursor-pointer hover:from-blue-500 hover:to-purple-500 transition-all">
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
                    {cookieFile ? 'Update Cookies' : 'Upload cookies.txt'}
                  </>
                )}
              </label>
            </div>
          </div>
        </div>

        <div className="card backdrop-blur-xl bg-opacity-50 border-gray-800">
          <form onSubmit={handleDownload} className="space-y-6">
            {/* URL Input */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Link className="h-5 w-5 text-gray-500" />
              </div>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste video link here..."
                className="w-full pl-12 pr-4 py-4 bg-black/20 border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl"
                required
              />
            </div>

            {/* Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Format Selection */}
              <div className="bg-black/20 p-4 rounded-xl border border-gray-800">
                <label className="text-sm text-gray-400 mb-3 block">Format</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormat('video')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${format === 'video'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                  >
                    <Video className="w-4 h-4" />
                    Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormat('audio')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${format === 'audio'
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                  >
                    <Music className="w-4 h-4" />
                    Audio
                  </button>
                </div>
              </div>

              {/* Crop Toggle */}
              <div className="bg-black/20 p-4 rounded-xl border border-gray-800">
                <label className="text-sm text-gray-400 mb-3 block">Advanced</label>
                <button
                  type="button"
                  onClick={() => setShowCrop(!showCrop)}
                  className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-all ${showCrop
                    ? 'bg-gray-700 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                >
                  <Scissors className="w-4 h-4" />
                  {showCrop ? 'Crop Enabled' : 'Enable Crop'}
                </button>
              </div>
            </div>

            {/* Crop Inputs */}
            <AnimatePresence>
              {showCrop && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-xl border border-gray-800">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Start Time (HH:MM:SS)</label>
                      <input
                        type="text"
                        placeholder="00:00:00"
                        value={cropStart}
                        onChange={(e) => setCropStart(e.target.value)}
                        className="w-full bg-gray-900 border-gray-700 text-sm py-2"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">End Time (HH:MM:SS)</label>
                      <input
                        type="text"
                        placeholder="00:00:00"
                        value={cropEnd}
                        onChange={(e) => setCropEnd(e.target.value)}
                        className="w-full bg-gray-900 border-gray-700 text-sm py-2"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all transform active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Download Now
                </>
              )}
            </button>

            {/* Status Message */}
            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`p-4 rounded-xl flex items-center gap-3 ${status.type === 'success'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}
                >
                  {status.type === 'success' ? (
                    <CheckCircle className="w-5 h-5" />
                  ) : (
                    <AlertCircle className="w-5 h-5" />
                  )}
                  {status.message}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default App
