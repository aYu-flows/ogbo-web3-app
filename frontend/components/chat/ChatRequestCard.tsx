'use client'

import { motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import WalletAddress from '@/components/chat/WalletAddress'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import type { ChatRequest } from '@/lib/store'

interface ChatRequestCardProps {
  request: ChatRequest
}

export default function ChatRequestCard({ request }: ChatRequestCardProps) {
  const { acceptRequest, rejectRequest, locale } = useStore()
  const [loadingAccept, setLoadingAccept] = useState(false)
  const [loadingReject, setLoadingReject] = useState(false)

  const handleAccept = async () => {
    setLoadingAccept(true)
    try {
      await acceptRequest(request.fromAddress)
    } finally {
      setLoadingAccept(false)
    }
  }

  const handleReject = async () => {
    setLoadingReject(true)
    try {
      await rejectRequest(request.fromAddress)
    } finally {
      setLoadingReject(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="bg-card rounded-2xl p-4 border border-border mb-3"
    >
      <div className="flex items-start gap-3 mb-3">
        <WalletAddress address={request.fromAddress} />
      </div>
      {request.message && (
        <p className="text-sm text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 mb-3 italic">
          "{request.message}"
        </p>
      )}
      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleAccept}
          disabled={loadingAccept || loadingReject}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--ogbo-green)] text-white rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {loadingAccept ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
            />
          ) : (
            <>
              <Check className="w-4 h-4" />
              {t('chat.accept', locale)}
            </>
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleReject}
          disabled={loadingAccept || loadingReject}
          className="flex-1 flex items-center justify-center gap-1.5 bg-[var(--ogbo-red)]/10 text-[var(--ogbo-red)] rounded-xl px-4 py-2.5 text-sm font-medium border border-[var(--ogbo-red)]/30 disabled:opacity-60"
        >
          {loadingReject ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-4 h-4 border-2 border-[var(--ogbo-red)]/30 border-t-[var(--ogbo-red)] rounded-full"
            />
          ) : (
            <>
              <X className="w-4 h-4" />
              {t('chat.reject', locale)}
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}
