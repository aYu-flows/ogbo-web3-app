'use client'

import { useState, useRef, useCallback } from 'react'
import { Mic, Square, Send, X } from 'lucide-react'
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

  const cancelRecording = useCallback(() => {
    if (!recorderRef.current) return
    recorderRef.current.cancel()
    recorderRef.current = null
    setIsRecording(false)
    setIsCancelling(false)
  }, [])

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
      {isRecording && !isNative ? (
        /* Web: recording state — cancel + stop/send buttons */
        <div className="flex items-center gap-1 relative">
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-red-500 font-medium whitespace-nowrap">
            {formatDuration(duration)}
          </span>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={cancelRecording}
            className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleClick}
            className="rounded-full p-1.5 bg-red-500 text-white transition-colors flex-shrink-0"
          >
            <Square className="w-5 h-5" />
          </motion.button>
        </div>
      ) : !isRecording ? (
        /* Not recording — mic button */
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          disabled={disabled}
          className={`rounded-full p-1.5 transition-colors flex-shrink-0 hover:bg-muted text-muted-foreground ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <Mic className="w-5 h-5" />
        </motion.button>
      ) : null}

      {/* Mobile: full-screen recording overlay */}
      {isRecording && isNative && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60"
          onTouchStart={(e) => {
            touchStartY.current = e.touches[0].clientY
          }}
          onTouchMove={(e) => {
            const deltaY = touchStartY.current - e.touches[0].clientY
            setIsCancelling(deltaY > 80)
          }}
          onTouchEnd={(e) => {
            // Only cancel on swipe-up release, otherwise do nothing (buttons handle their own taps)
            if (isCancelling) {
              recorderRef.current?.cancel()
              recorderRef.current = null
              setIsRecording(false)
              setIsCancelling(false)
            }
          }}
        >
          {/* Recording animation indicator */}
          <div className="mb-6 w-20 h-20 rounded-full flex items-center justify-center bg-white/10 border-2 border-white/30">
            <Mic className="w-10 h-10 text-white animate-pulse" />
          </div>
          <p className="text-white text-4xl font-mono mb-3">{formatDuration(duration)}</p>
          <p className={`text-sm mb-10 ${isCancelling ? 'text-red-400' : 'text-white/60'}`}>
            {isCancelling
              ? (locale === 'zh' ? '松开取消' : 'Release to cancel')
              : t('chat.slideToCancel', locale)}
          </p>
          {/* Cancel + Send buttons */}
          <div className="flex items-center gap-8">
            <button
              onTouchEnd={(e) => {
                e.stopPropagation()
                cancelRecording()
              }}
              className="w-14 h-14 rounded-full bg-red-500/80 flex items-center justify-center active:scale-90 transition-transform"
            >
              <X className="w-7 h-7 text-white" />
            </button>
            <button
              onTouchEnd={async (e) => {
                e.stopPropagation()
                await stopAndSend()
              }}
              className="w-14 h-14 rounded-full bg-green-500 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Send className="w-7 h-7 text-white" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
