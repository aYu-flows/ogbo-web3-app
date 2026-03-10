'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, RotateCw } from 'lucide-react'

interface VoiceMessagePlayerProps {
  fileUrl?: string
  duration?: number
  isMe: boolean
  uploadProgress?: number
  status?: string
  onRetry?: () => void
}

let currentAudio: HTMLAudioElement | null = null

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VoiceMessagePlayer({
  fileUrl,
  duration = 0,
  isMe,
  uploadProgress,
  status,
  onRetry,
}: VoiceMessagePlayerProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number>(0)

  const isUploading = uploadProgress !== undefined && uploadProgress < 100
  const isFailed = status === 'failed'

  const updateProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.duration) {
      setProgress((audio.currentTime / audio.duration) * 100)
    }
    if (playing) {
      rafRef.current = requestAnimationFrame(updateProgress)
    }
  }, [playing])

  useEffect(() => {
    if (playing) {
      rafRef.current = requestAnimationFrame(updateProgress)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, updateProgress])

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const togglePlay = () => {
    if (!fileUrl) return

    if (playing) {
      audioRef.current?.pause()
      setPlaying(false)
      return
    }

    // Stop any currently playing audio
    if (currentAudio && currentAudio !== audioRef.current) {
      currentAudio.pause()
      currentAudio.currentTime = 0
    }

    if (!audioRef.current) {
      const audio = new Audio(fileUrl)
      audio.onended = () => {
        setPlaying(false)
        setProgress(0)
        audio.currentTime = 0
        currentAudio = null
      }
      audioRef.current = audio
    }

    audioRef.current.play()
    currentAudio = audioRef.current
    setPlaying(true)
  }

  return (
    <div className="w-[180px] flex items-center gap-2 py-1">
      {isUploading ? (
        <div className="flex items-center gap-2 w-full">
          <div className="h-1 flex-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--ogbo-blue)] transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <span className={`text-xs ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
            {Math.round(uploadProgress!)}%
          </span>
        </div>
      ) : isFailed ? (
        <button
          onClick={onRetry}
          className="rounded-full p-1.5 hover:bg-muted transition-colors"
        >
          <RotateCw className="w-4 h-4 text-destructive" />
        </button>
      ) : (
        <>
          <button
            onClick={togglePlay}
            className={`flex-shrink-0 rounded-full p-1 transition-colors ${
              isMe ? 'hover:bg-white/20' : 'hover:bg-muted'
            }`}
          >
            {playing ? (
              <Pause className={`w-4 h-4 ${isMe ? 'text-white' : 'text-foreground'}`} />
            ) : (
              <Play className={`w-4 h-4 ${isMe ? 'text-white' : 'text-foreground'}`} />
            )}
          </button>

          <div className="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isMe ? 'bg-white/70' : 'bg-[var(--ogbo-blue)]'}`}
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className={`text-xs flex-shrink-0 ${isMe ? 'text-white/60' : 'text-muted-foreground'}`}>
            {formatDuration(duration)}
          </span>
        </>
      )}
    </div>
  )
}
