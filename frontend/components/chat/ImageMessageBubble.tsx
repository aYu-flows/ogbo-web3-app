'use client'

import { useState } from 'react'
import { RotateCw } from 'lucide-react'

interface ImageMessageBubbleProps {
  fileUrl?: string
  fileName?: string
  uploadProgress?: number
  status?: string
  isMe: boolean
  onRetry?: () => void
  onClick?: () => void
}

export default function ImageMessageBubble({
  fileUrl,
  fileName,
  uploadProgress,
  status,
  isMe,
  onRetry,
  onClick,
}: ImageMessageBubbleProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const isUploading = uploadProgress !== undefined && uploadProgress < 100
  const isFailed = status === 'failed'

  if (!fileUrl && !isUploading && !isFailed) {
    return (
      <div className="bg-muted animate-pulse w-[200px] h-[150px] rounded-lg" />
    )
  }

  return (
    <div className="relative cursor-pointer" onClick={!isUploading && !isFailed ? onClick : undefined}>
      {!loaded && !error && (
        <div className="bg-muted animate-pulse w-[200px] h-[150px] rounded-lg" />
      )}

      {fileUrl && !error && (
        <img
          src={fileUrl}
          alt={fileName || 'image'}
          className={`max-w-[200px] max-h-[200px] rounded-lg object-cover ${!loaded ? 'hidden' : ''}`}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}

      {error && (
        <div className="w-[200px] h-[150px] rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
          Failed to load
        </div>
      )}

      {isUploading && (
        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-medium">{Math.round(uploadProgress!)}%</span>
        </div>
      )}

      {isFailed && (
        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry?.()
            }}
            className="rounded-full p-2 bg-white/20 hover:bg-white/30 transition-colors"
          >
            <RotateCw className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
