'use client'

import { useState } from 'react'
import { useStore } from '@/lib/store'
import { addressToColor } from '@/lib/chat'

interface UserAvatarProps {
  address: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
}

export default function UserAvatar({ address, size = 'md', className = '' }: UserAvatarProps) {
  const getAvatarUrl = useStore((s) => s.getAvatarUrl)
  const getDisplayName = useStore((s) => s.getDisplayName)
  const [imgError, setImgError] = useState(false)

  const avatarUrl = getAvatarUrl(address)
  const displayName = getDisplayName(address)
  const fallbackColor = addressToColor(address)
  const initial = displayName[0]?.toUpperCase() || address.slice(2, 3).toUpperCase()

  const showImage = avatarUrl && !imgError

  return (
    <div className={`${sizeMap[size]} rounded-full flex-shrink-0 overflow-hidden ${className}`}>
      {showImage ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ backgroundColor: fallbackColor }}
        >
          <span className="text-white font-semibold">{initial}</span>
        </div>
      )}
    </div>
  )
}
