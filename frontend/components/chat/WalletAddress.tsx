'use client'

import { motion } from 'framer-motion'
import { Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { addressToColor } from '@/lib/push'
import toast from 'react-hot-toast'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'

interface WalletAddressProps {
  address: string
  showCopyIcon?: boolean
  className?: string
}

export default function WalletAddress({ address, showCopyIcon = true, className = '' }: WalletAddressProps) {
  const [copied, setCopied] = useState(false)
  const { locale } = useStore()

  if (!address) return null

  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`
  const dotColor = addressToColor(address)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toast.success(t('chat.addressCopied', locale))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('chat.invalidAddress', locale))
    }
  }

  return (
    <motion.button
      onClick={handleCopy}
      whileTap={{ scale: 0.95 }}
      className={`flex items-center gap-1.5 group ${className}`}
      title={address}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <span className="text-sm font-mono text-muted-foreground group-hover:text-foreground transition-colors">
        {shortAddress}
      </span>
      {showCopyIcon && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
          {copied
            ? <Check className="w-3.5 h-3.5 text-[var(--ogbo-green)]" />
            : <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </span>
      )}
    </motion.button>
  )
}
