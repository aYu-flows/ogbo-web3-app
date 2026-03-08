'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'

interface UserAvatarProps {
  address: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
  onPreview?: () => void
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export default function UserAvatar({ address, size = 'md', className = '', onPreview }: UserAvatarProps) {
  const getAvatarUrl = useStore((s) => s.getAvatarUrl)
  const getDisplayName = useStore((s) => s.getDisplayName)
  const [imgError, setImgError] = useState(false)

  const avatarUrl = getAvatarUrl(address)
  const displayName = getDisplayName(address)

  const showImage = avatarUrl && !imgError

  const clickable = showImage && !!onPreview

  return (
    <div
      className={`${sizeMap[size]} rounded-full flex-shrink-0 overflow-hidden ${clickable ? 'cursor-pointer' : ''} ${className}`}
      onClick={clickable ? (e) => { e.stopPropagation(); onPreview!() } : undefined}
    >
      {showImage ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <img
          src="/default-avatar.svg"
          alt={displayName}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  )
}
