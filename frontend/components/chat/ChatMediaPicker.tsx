'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Camera, ImageIcon, Paperclip } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { t } from '@/lib/i18n'
import { useStore } from '@/lib/store'

let Capacitor: { isNativePlatform: () => boolean } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Capacitor = require('@capacitor/core').Capacitor
} catch {
  // Not in Capacitor environment
}

interface ChatMediaPickerProps {
  onImageSelect: (file: File) => void
  onFileSelect: (file: File) => void
  onPhotoCapture: (file: File) => void
}

export default function ChatMediaPicker({
  onImageSelect,
  onFileSelect,
  onPhotoCapture,
}: ChatMediaPickerProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const locale = useStore((s) => s.locale)
  const isNative = Capacitor?.isNativePlatform() ?? false

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const options = [
    ...(isNative
      ? [
          {
            icon: Camera,
            label: t('chat.takePhoto', locale) || '拍照',
            action: () => cameraInputRef.current?.click(),
          },
        ]
      : []),
    {
      icon: ImageIcon,
      label: t('chat.selectImage', locale) || '图片',
      action: () => imageInputRef.current?.click(),
    },
    {
      icon: Paperclip,
      label: t('chat.selectFile', locale) || '文件',
      action: () => fileInputRef.current?.click(),
    },
  ]

  return (
    <div className="relative" ref={panelRef}>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        className="rounded-full p-1.5 hover:bg-muted transition-colors flex-shrink-0"
      >
        <Plus className={`w-5 h-5 text-muted-foreground transition-transform ${open ? 'rotate-45' : ''}`} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-xl shadow-lg overflow-hidden flex"
          >
            {options.map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  opt.action()
                  setOpen(false)
                }}
                className="flex flex-col items-center gap-1.5 px-4 py-3 hover:bg-muted transition-colors text-xs whitespace-nowrap"
              >
                <opt.icon className="w-5 h-5 text-muted-foreground" />
                <span>{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPhotoCapture(file)
          e.target.value = ''
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onImageSelect(file)
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelect(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
