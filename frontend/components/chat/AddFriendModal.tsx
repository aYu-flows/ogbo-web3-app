'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Send, MessageCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { utils as ethersUtils } from 'ethers'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import WalletAddress from '@/components/chat/WalletAddress'

interface AddFriendModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenChat?: (chatId: string) => void
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/

export default function AddFriendModal({ isOpen, onClose, onOpenChat }: AddFriendModalProps) {
  const { searchUserByAddress, sendFriendRequest, chats, chatRequests, walletAddress, pushInitialized, isConnectingPush, pushInitFailed, locale, switchTab, resetPushFailed } = useStore()
  const [searchInput, setSearchInput] = useState('')
  const [normalizedAddr, setNormalizedAddr] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<any>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [showMsgInput, setShowMsgInput] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine state of this address (use lowercase comparison for case-insensitive matching)
  const isValidAddress = ADDRESS_REGEX.test(searchInput.trim())
  const isSelf = walletAddress && searchInput.trim().toLowerCase() === walletAddress.toLowerCase()
  const alreadyFriend = chats.some((c) => c.walletAddress?.toLowerCase() === searchInput.trim().toLowerCase())
  const alreadySent = chatRequests.some((r) => r.fromAddress.toLowerCase() === searchInput.trim().toLowerCase())

  // Debounced search with EIP-55 address normalization
  useEffect(() => {
    if (!isOpen) return
    const rawAddr = searchInput.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchResult(null)
    setSearchError(null)
    setNormalizedAddr('')  // Reset normalized address on every input change
    setSent(false)

    if (!rawAddr) return

    if (!ADDRESS_REGEX.test(rawAddr)) {
      if (rawAddr.length > 0) setSearchError(t('chat.invalidAddress', locale))
      return
    }

    // EIP-55 checksum normalization (compatible with all-lowercase and mixed-case input)
    let addr = rawAddr
    try {
      addr = ethersUtils.getAddress(rawAddr)
    } catch {
      setSearchError(t('chat.invalidAddress', locale))
      return
    }
    setNormalizedAddr(addr)

    // pushInitFailed: banner handles the UI, no need to also set searchError
    if (pushInitFailed) return

    if (!pushInitialized) {
      if (isConnectingPush) {
        setSearchError(locale === 'zh' ? '聊天功能初始化中，请稍候...' : 'Chat initializing, please wait...')
      } else {
        setSearchError(locale === 'zh' ? '聊天连接中...' : 'Connecting...')
      }
      return
    }

    // isSelf check (using normalized address)
    if (walletAddress && addr.toLowerCase() === walletAddress.toLowerCase()) {
      setSearchError(t('chat.selfAddress', locale))
      return
    }

    // Debounced search using normalized (checksummed) address
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchUserByAddress(addr)
        if (result) {
          setSearchResult(result)
        } else {
          setSearchError(t('chat.noUserFound', locale))
        }
      } catch {
        setSearchError(t('chat.noUserFound', locale))
      } finally {
        setSearching(false)
      }
    }, 500)
  }, [searchInput, isOpen, pushInitialized, isConnectingPush, pushInitFailed])

  const handleSend = async () => {
    if (!isValidAddress || sending || sent) return
    if (!normalizedAddr) return  // Normalization failed, do not send
    setSending(true)
    try {
      await sendFriendRequest(normalizedAddr, requestMsg)  // Use checksummed address
      setSent(true)
      const { default: toast } = await import('react-hot-toast')
      toast.success(locale === 'zh' ? '好友请求已发送！' : 'Friend request sent!')
    } catch {
      const { default: toast } = await import('react-hot-toast')
      toast.error(locale === 'zh' ? '发送失败，请重试' : 'Failed, please retry')
    } finally {
      setSending(false)
    }
  }

  const handleOpenChat = (c: typeof chats[0]) => {
    if (onOpenChat) onOpenChat(c.id)
    onClose()
  }

  const handleClose = () => {
    setSearchInput('')
    setNormalizedAddr('')
    setSearchResult(null)
    setSearchError(null)
    setSent(false)
    setRequestMsg('')
    setShowMsgInput(false)
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-card rounded-2xl shadow-xl w-full max-w-sm overflow-hidden max-h-[80vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h3 className="text-base font-semibold">{t('chat.addFriend', locale)}</h3>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onPaste={(e) => {
                    // Explicit paste handler for Android IME compatibility:
                    // some IME implementations bypass onChange on paste.
                    const text = e.clipboardData?.getData('text') || ''
                    if (text.trim()) setTimeout(() => setSearchInput(text.trim()), 0)
                  }}
                  placeholder={t('chat.searchByAddress', locale)}
                  className="w-full bg-muted rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
              </div>

              {/* Push init failed banner — always visible when push init fails, no address required */}
              {pushInitFailed && !isConnectingPush && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between bg-[var(--ogbo-red)]/10 rounded-xl px-3 py-2.5"
                >
                  <p className="text-xs text-[var(--ogbo-red)]">
                    {locale === 'zh' ? '聊天功能暂时不可用' : 'Chat unavailable'}
                  </p>
                  <button
                    onClick={() => {
                      setSearchError(null)
                      resetPushFailed()
                    }}
                    className="text-xs text-[var(--ogbo-blue)] font-medium hover:opacity-80 transition-opacity ml-2 flex-shrink-0"
                  >
                    {locale === 'zh' ? '重试连接' : 'Retry'}
                  </button>
                </motion.div>
              )}

              {/* Error state (non-pushInitFailed errors) */}
              {searchError && (
                <p className="text-sm text-[var(--ogbo-red)] text-center">{searchError}</p>
              )}

              {/* Search result */}
              {searchResult && !searchError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-muted/50 rounded-xl p-4 space-y-3"
                >
                  {/* Show checksummed address for consistent display */}
                  <WalletAddress address={normalizedAddr || searchInput.trim()} />

                  {alreadyFriend ? (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        const c = chats.find((c) => c.walletAddress?.toLowerCase() === searchInput.trim().toLowerCase())
                        if (c) handleOpenChat(c)
                      }}
                      className="w-full flex items-center justify-center gap-2 bg-muted text-foreground rounded-xl px-4 py-2.5 text-sm font-medium"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {t('chat.sendMessageTo', locale)}
                    </motion.button>
                  ) : alreadySent || sent ? (
                    <div className="w-full text-center bg-muted text-muted-foreground rounded-xl px-4 py-2.5 text-sm font-medium cursor-not-allowed">
                      {t('chat.requestSent', locale)}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Collapsible message input */}
                      <button
                        onClick={() => setShowMsgInput(!showMsgInput)}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showMsgInput ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {t('chat.requestMessage', locale)}
                      </button>
                      <AnimatePresence>
                        {showMsgInput && (
                          <motion.textarea
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            value={requestMsg}
                            onChange={(e) => setRequestMsg(e.target.value)}
                            placeholder={t('chat.requestMessagePlaceholder', locale)}
                            rows={2}
                            className="w-full bg-muted rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                          />
                        )}
                      </AnimatePresence>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSend}
                        disabled={sending}
                        className="w-full flex items-center justify-center gap-2 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-60 transition-colors"
                      >
                        {sending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            {t('chat.sendRequest', locale)}
                          </>
                        )}
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Existing friends */}
              {chats.filter((c) => c.walletAddress).length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">{t('chat.existingFriends', locale)}</p>
                  <div className="space-y-2">
                    {chats
                      .filter((c) => c.walletAddress)
                      .map((c) => (
                        <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                          <WalletAddress address={c.walletAddress!} />
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleOpenChat(c)}
                            className="text-xs text-[var(--ogbo-blue)] font-medium"
                          >
                            {t('chat.sendMessageTo', locale)}
                          </motion.button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
