'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { formatFileSize } from '@/lib/chat-media'

interface ImagePreviewModalProps {
  file: File | null
  onSend: () => void
  onCancel: () => void
}

export default function ImagePreviewModal({ file, onSend, onCancel }: ImagePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <AnimatePresence>
      {file && previewUrl && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center"
          onClick={onCancel}
        >
          {/* Close button */}
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Image */}
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.2 }}
            src={previewUrl}
            alt={file.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[90vw] max-h-[70vh] object-contain rounded-lg"
          />

          {/* Bottom bar */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="mt-4 flex items-center gap-4 bg-black/60 rounded-xl px-4 py-3"
          >
            <div className="text-white text-sm">
              <p className="font-medium truncate max-w-[200px]">{file.name}</p>
              <p className="text-white/60 text-xs">{formatFileSize(file.size)}</p>
            </div>
            <button
              onClick={onCancel}
              className="px-4 py-1.5 rounded-lg border border-white/30 text-white text-sm hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              className="px-4 py-1.5 rounded-lg bg-[var(--ogbo-blue)] text-white text-sm hover:bg-[var(--ogbo-blue-hover)] transition-colors"
            >
              Send
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
