'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square } from 'lucide-react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { VoiceRecorder } from '@/lib/voice-recorder'
import { t } from '@/lib/i18n'
import { useStore } from '@/lib/store'

let Capacitor: { isNativePlatform: () => boolean } | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Capacitor = require('@capacitor/core').Capacitor
} catch {
  // Not in Capacitor environment
}

interface VoiceRecordButtonProps {
  onSend: (blob: Blob, duration: number) => void
  disabled?: boolean
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function VoiceRecordButton({ onSend, disabled }: VoiceRecordButtonProps) {
  const locale = useStore((s) => s.locale)
  const [isRecording, setIsRecording] = useState(false)
  const [duration, setDuration] = useState(0)
  const [isCancelling, setIsCancelling] = useState(false)
  const recorderRef = useRef<VoiceRecorder | null>(null)
  const touchStartY = useRef(0)
  const isNative = Capacitor?.isNativePlatform() ?? false

  const startRecording = useCallback(async () => {
    try {
      const recorder = new VoiceRecorder(
        (sec) => setDuration(sec),
        async () => {
          // Auto-stop at 60s
          if (recorderRef.current) {
            const { blob, duration: dur } = await recorderRef.current.stop()
            setIsRecording(false)
            onSend(blob, dur)
            recorderRef.current = null
          }
        }
      )
      await recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      setDuration(0)
      setIsCancelling(false)
    } catch (err) {
      const msg = err instanceof Error && err.message === 'micPermissionDenied'
        ? t('chat.micPermissionDenied', locale)
        : t('chat.uploadFailed', locale)
      toast.error(msg)
    }
  }, [onSend])

  const stopAndSend = useCallback(async () => {
    if (!recorderRef.current) return
    if (isCancelling) {
      recorderRef.current.cancel()
      recorderRef.current = null
      setIsRecording(false)
      setIsCancelling(false)
      return
    }
    try {
      const { blob, duration: dur } = await recorderRef.current.stop()
      recorderRef.current = null
      setIsRecording(false)
      if (dur < 1) {
        toast(t('chat.recordTooShort', locale))
        return
      }
      onSend(blob, dur)
    } catch {
      toast.error(t('chat.uploadFailed', locale))
      setIsRecording(false)
    }
  }, [isCancelling, onSend])

  // Web: click to toggle
  const handleClick = useCallback(async () => {
    if (isNative) return
    if (isRecording) {
      await stopAndSend()
    } else {
      await startRecording()
    }
  }, [isNative, isRecording, stopAndSend, startRecording])

  // Mobile: touch handlers
  const handleTouchStart = useCallback(async (e: React.TouchEvent) => {
    if (!isNative) return
    touchStartY.current = e.touches[0].clientY
    await startRecording()
  }, [isNative, startRecording])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isNative || !isRecording) return
    const deltaY = touchStartY.current - e.touches[0].clientY
    setIsCancelling(deltaY > 80)
  }, [isNative, isRecording])

  const handleTouchEnd = useCallback(async () => {
    if (!isNative || !isRecording) return
    await stopAndSend()
  }, [isNative, isRecording, stopAndSend])

  return (
    <div className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        disabled={disabled}
        className={`rounded-full p-1.5 transition-colors flex-shrink-0 ${
          isRecording
            ? 'bg-red-500 text-white'
            : 'hover:bg-muted text-muted-foreground'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {isRecording && !isNative ? (
          <Square className="w-5 h-5" />
        ) : (
          <Mic className={`w-5 h-5 ${isRecording ? 'text-white' : ''}`} />
        )}
      </motion.button>

      {/* Web: show duration next to button */}
      {isRecording && !isNative && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-red-500 font-medium whitespace-nowrap">
          {formatDuration(duration)}
        </span>
      )}

      {/* Mobile: full-screen recording overlay */}
      {isRecording && isNative && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
          <p className="text-white text-4xl font-mono mb-4">{formatDuration(duration)}</p>
          <p className={`text-lg ${isCancelling ? 'text-red-400' : 'text-white/80'}`}>
            {isCancelling
              ? (locale === 'zh' ? '松开取消' : 'Release to cancel')
              : t('chat.slideToCancel', locale)}
          </p>
          <div className={`mt-6 w-16 h-16 rounded-full flex items-center justify-center ${
            isCancelling ? 'bg-red-500/30' : 'bg-red-500/50'
          }`}>
            <Mic className="w-8 h-8 text-white" />
          </div>
        </div>
      )}
    </div>
  )
}
