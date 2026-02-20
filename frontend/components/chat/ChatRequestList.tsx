'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Inbox } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import ChatRequestCard from '@/components/chat/ChatRequestCard'

interface ChatRequestListProps {
  onBack: () => void
}

export default function ChatRequestList({ onBack }: ChatRequestListProps) {
  const { chatRequests, locale } = useStore()

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="absolute inset-0 bg-background z-20 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border bg-card">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="rounded-full p-1.5 hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h2 className="text-base font-semibold">
          {t('chat.friendRequests', locale)}
          {chatRequests.length > 0 && (
            <span className="ml-2 bg-[var(--ogbo-blue)] text-white text-xs rounded-full px-2 py-0.5">
              {chatRequests.length}
            </span>
          )}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {chatRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Inbox className="w-12 h-12 opacity-30" />
            <p className="text-sm">{t('chat.noRequests', locale)}</p>
          </div>
        ) : (
          <AnimatePresence>
            {chatRequests.map((req) => (
              <ChatRequestCard key={req.fromAddress} request={req} />
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  )
}
