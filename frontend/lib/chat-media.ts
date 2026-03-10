'use client'

import { supabase } from '@/lib/supabaseClient'

// --- Constants ---
export const IMAGE_MAX_SIZE = 10 * 1024 * 1024 // 10MB
export const FILE_MAX_SIZE = 50 * 1024 * 1024 // 50MB
export const VOICE_MAX_SIZE = 5 * 1024 * 1024 // 5MB
export const VOICE_MAX_DURATION = 60 // seconds
export const IMAGE_MAX_DIMENSION = 1920
export const CHAT_FILES_BUCKET = 'chat-files'

export const IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]

export const VOICE_ALLOWED_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/mpeg',
]

// --- Validation ---

export function validateImageFile(file: File): string | null {
  if (!IMAGE_ALLOWED_TYPES.includes(file.type)) {
    return 'chat.imageFormatError'
  }
  if (file.size > IMAGE_MAX_SIZE) {
    return 'chat.fileTooLarge'
  }
  return null
}

export function validateFile(file: File): string | null {
  if (file.size > FILE_MAX_SIZE) {
    return 'chat.fileTooLarge'
  }
  return null
}

export function validateVoiceFile(file: File, duration: number): string | null {
  if (!VOICE_ALLOWED_TYPES.includes(file.type)) {
    return 'chat.imageFormatError'
  }
  if (file.size > VOICE_MAX_SIZE) {
    return 'chat.fileTooLarge'
  }
  if (duration > VOICE_MAX_DURATION) {
    return 'chat.recordTooShort'
  }
  return null
}

// --- Image Compression ---

export async function compressImage(
  file: File,
  maxDimension: number = IMAGE_MAX_DIMENSION
): Promise<File> {
  // Only compress raster image types (skip GIF to preserve animation)
  if (file.type === 'image/gif') return file

  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      const { width, height } = img

      // No compression needed if already within bounds
      if (width <= maxDimension && height <= maxDimension) {
        resolve(file)
        return
      }

      // Calculate new dimensions maintaining aspect ratio
      let newWidth = width
      let newHeight = height
      if (width > height) {
        newWidth = maxDimension
        newHeight = Math.round((height / width) * maxDimension)
      } else {
        newHeight = maxDimension
        newWidth = Math.round((width / height) * maxDimension)
      }

      const canvas = document.createElement('canvas')
      canvas.width = newWidth
      canvas.height = newHeight

      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, newWidth, newHeight)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          const compressed = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressed)
        },
        'image/jpeg',
        0.85
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(file)
    }

    img.src = url
  })
}

// --- File Name Sanitization ---

export function sanitizeFileName(name: string): string {
  // Extract extension
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot > 0 ? name.slice(lastDot) : ''
  const baseName = lastDot > 0 ? name.slice(0, lastDot) : name

  // Remove path traversal and special characters
  const sanitized = baseName
    .replace(/\.\.\//g, '')
    .replace(/[^a-zA-Z0-9\-_\.]/g, '')

  // Limit length (preserve extension)
  const maxBase = 100 - ext.length
  const trimmed = sanitized.slice(0, Math.max(1, maxBase))

  return trimmed + ext
}

// --- Upload ---

export async function uploadChatFile(
  chatId: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<{ url: string; fileName: string; fileSize: number }> {
  const sanitized = sanitizeFileName(file.name)
  const timestamp = Date.now()
  const path = `${chatId}/${timestamp}_${sanitized}`

  // Simulate progress start
  onProgress?.(50)

  const { error } = await supabase.storage
    .from(CHAT_FILES_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    throw new Error(`Upload failed: ${error.message}`)
  }

  // Simulate progress complete
  onProgress?.(100)

  const {
    data: { publicUrl },
  } = supabase.storage.from(CHAT_FILES_BUCKET).getPublicUrl(path)

  return {
    url: publicUrl,
    fileName: sanitized,
    fileSize: file.size,
  }
}

// --- Utilities ---

export function getFileTypeIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  const map: Record<string, string[]> = {
    pdf: ['pdf'],
    word: ['doc', 'docx'],
    excel: ['xls', 'xlsx', 'csv'],
    zip: ['zip', 'rar', '7z', 'tar', 'gz'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'],
    audio: ['mp3', 'wav', 'ogg', 'webm', 'm4a', 'aac', 'flac'],
  }

  for (const [icon, extensions] of Object.entries(map)) {
    if (extensions.includes(ext)) return icon
  }

  return 'default'
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
