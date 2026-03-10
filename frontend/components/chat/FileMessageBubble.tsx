'use client'

import { RotateCw, FileText, FileSpreadsheet, File } from 'lucide-react'
import { getFileTypeIcon, formatFileSize } from '@/lib/chat-media'

interface FileMessageBubbleProps {
  fileUrl?: string
  fileName?: string
  fileSize?: number
  uploadProgress?: number
  status?: string
  isMe: boolean
  onRetry?: () => void
}

function FileIcon({ fileName }: { fileName: string }) {
  const type = getFileTypeIcon(fileName)
  const iconClass = 'w-8 h-8 text-muted-foreground'

  switch (type) {
    case 'pdf':
      return <FileText className={iconClass} />
    case 'excel':
      return <FileSpreadsheet className={iconClass} />
    default:
      return <File className={iconClass} />
  }
}

export default function FileMessageBubble({
  fileUrl,
  fileName = 'file',
  fileSize,
  uploadProgress,
  status,
  isMe,
  onRetry,
}: FileMessageBubbleProps) {
  const isUploading = uploadProgress !== undefined && uploadProgress < 100
  const isFailed = status === 'failed'

  const handleClick = () => {
    if (!isUploading && !isFailed && fileUrl) {
      window.open(fileUrl, '_blank')
    }
  }

  return (
    <div
      onClick={handleClick}
      className={`w-[220px] rounded-xl border cursor-pointer overflow-hidden ${
        isMe ? 'border-white/20 bg-white/10' : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="flex-shrink-0">
          <FileIcon fileName={fileName} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-foreground'}`}>
            {fileName}
          </p>
          {fileSize !== undefined && (
            <p className={`text-xs mt-0.5 ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
              {formatFileSize(fileSize)}
            </p>
          )}
        </div>
        {isFailed && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry?.()
            }}
            className="flex-shrink-0 rounded-full p-1.5 hover:bg-muted transition-colors"
          >
            <RotateCw className="w-4 h-4 text-destructive" />
          </button>
        )}
      </div>

      {isUploading && (
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-[var(--ogbo-blue)] transition-all duration-300"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  )
}
