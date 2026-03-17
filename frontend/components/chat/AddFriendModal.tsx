'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Send, MessageCircle, Loader2, ChevronDown, ChevronUp, ClipboardPaste } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
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

interface SelectedUser {
  address: string
  nickname?: string
  avatarUrl?: string | null
}

// Read clipboard text, preferring Capacitor Clipboard on native platforms.
// Always resolves to a string; never throws.
async function readClipboardText(): Promise<string> {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (Capacitor.isNativePlatform()) {
      const { Clipboard } = await import('@capacitor/clipboard')
      const { value } = await Clipboard.read()
      if (value) return value
    }
  } catch {
    // Capacitor unavailable or version mismatch — fall through
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      return await navigator.clipboard.readText()
    }
  } catch {
    // Permission denied or unsupported — fall through
  }
  return ''
}

// Default avatar SVG as data URI for search results without cached profile
const DEFAULT_AVATAR_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="%23d1d5db"/><circle cx="20" cy="16" r="6" fill="%239ca3af"/><ellipse cx="20" cy="34" rx="11" ry="9" fill="%239ca3af"/></svg>')}`

export default function AddFriendModal({ isOpen, onClose, onOpenChat }: AddFriendModalProps) {
  const { searchUserByAddress, searchUserByNickname, sendFriendRequest, chats, chatRequests, walletAddress, locale, switchTab } = useStore()
  const [normalizedAddr, setNormalizedAddr] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<SelectedUser[]>([])
  const [selectedUser, setSelectedUser] = useState<SelectedUser | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [requestMsg, setRequestMsg] = useState('')
  const [showMsgInput, setShowMsgInput] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoFillSessionRef = useRef(0)
  const requestMsgRef = useRef<HTMLTextAreaElement>(null)

  // --- Uncontrolled input + polling for Android WebView IME compatibility ---
  // On Android WebView (Capacitor), NEITHER React's synthetic onChange NOR the
  // native DOM 'input' event fires when the user taps an IME candidate.
  // The text IS inserted into the DOM (visible on screen, in el.value), but
  // no event is dispatched.
  //
  // Solution: native 'input' event for instant detection of regular keystrokes,
  // plus a 300ms polling interval as fallback to catch IME candidate insertions.
  // The poll overhead is negligible and 300ms is well within the 500ms search debounce.
  //
  // Uses a callback ref because the input is conditionally rendered ({isOpen && ...}).
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const [searchText, setSearchText] = useState('')

  const searchInputCallbackRef = useCallback((el: HTMLInputElement | null) => {
    // Cleanup previous listeners + poll
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    searchInputRef.current = el
    if (el) {
      let lastSynced = el.value
      const sync = () => {
        const v = el.value
        if (v !== lastSynced) {
          lastSynced = v
          setSearchText(v)
        }
      }
      // Primary: native input event (instant for regular keyboard input)
      el.addEventListener('input', sync)
      // Fallback: polling to catch IME candidate taps that fire no events
      const pollId = setInterval(sync, 300)
      cleanupRef.current = () => {
        el.removeEventListener('input', sync)
        clearInterval(pollId)
      }
    }
  }, [])

  // Helper to programmatically set input value + sync React state
  const setSearchInput = useCallback((val: string) => {
    if (searchInputRef.current) searchInputRef.current.value = val
    setSearchText(val)
  }, [])

  // Helper: check friend/request status for a given address
  const isAlreadyFriend = (addr: string) =>
    chats.some((c) => c.walletAddress?.toLowerCase() === addr.toLowerCase())
  const isAlreadySent = (addr: string) =>
    chatRequests.some((r) => r.fromAddress.toLowerCase() === addr.toLowerCase())

  // Derive states for currently selected user
  const selectedAddr = selectedUser?.address || normalizedAddr || ''
  const alreadyFriend = selectedAddr ? isAlreadyFriend(selectedAddr) : false
  const alreadySent = selectedAddr ? isAlreadySent(selectedAddr) : false

  // Plan B: auto-fill clipboard content when modal opens
  useEffect(() => {
    if (!isOpen) return
    const session = ++autoFillSessionRef.current
    readClipboardText()
      .then((text) => {
        if (autoFillSessionRef.current !== session) return // stale callback — discard
        const trimmed = text.trim()
        if (ADDRESS_REGEX.test(trimmed)) {
          // Only fill if user hasn't typed anything yet
          const current = searchInputRef.current?.value || ''
          if (!current && trimmed) setSearchInput(trimmed)
        }
      })
      .catch(() => {
        // Clipboard read failed — silently ignore
      })
  }, [isOpen])

  // Debounced search: auto-detect address vs nickname
  // Uses searchText from native DOM 'input' event — works reliably on Android
  // WebView where React's onChange misses IME candidate selections.
  useEffect(() => {
    if (!isOpen) return
    const raw = searchText.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchResults([])
    setSelectedUser(null)
    setSearchError(null)
    setNormalizedAddr('')
    setSent(false)

    if (!raw) return

    const isAddress = ADDRESS_REGEX.test(raw)

    if (isAddress) {
      // === Address search mode ===
      let addr = raw
      try {
        addr = ethersUtils.getAddress(raw)
      } catch {
        setSearchError(t('chat.invalidAddress', locale))
        return
      }
      setNormalizedAddr(addr)

      if (walletAddress && addr.toLowerCase() === walletAddress.toLowerCase()) {
        setSearchError(t('chat.selfAddress', locale))
        return
      }

      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const result = await searchUserByAddress(addr)
          if (result) {
            const user: SelectedUser = { address: result.address }
            setSearchResults([user])
            setSelectedUser(user) // Auto-select for address search
          } else {
            setSearchError(t('chat.noUserFound', locale))
          }
        } catch {
          setSearchError(t('chat.noUserFound', locale))
        } finally {
          setSearching(false)
        }
      }, 300)
    } else {
      // === Nickname search mode ===
      if (raw.length < 1) return

      debounceRef.current = setTimeout(async () => {
        setSearching(true)
        try {
          const results = await searchUserByNickname(raw)
          if (results.length > 0) {
            setSearchResults(results.map((r) => ({
              address: r.address,
              nickname: r.nickname,
              avatarUrl: r.avatarUrl,
            })))
            // If only one result, auto-select
            if (results.length === 1) {
              setSelectedUser({
                address: results[0].address,
                nickname: results[0].nickname,
                avatarUrl: results[0].avatarUrl,
              })
            }
          } else {
            setSearchError(t('chat.nicknameSearchNoResult', locale))
          }
        } catch {
          setSearchError(t('chat.nicknameSearchNoResult', locale))
        } finally {
          setSearching(false)
        }
      }, 500)
    }
  }, [searchText])

  // Plan A: paste button handler — reads clipboard directly on user gesture
  const handlePasteButton = async () => {
    try {
      const text = await readClipboardText()
      if (text.trim()) setSearchInput(text.trim())
    } catch {
      // Silently ignore
    }
  }

  const handleSend = async () => {
    if (!selectedUser || sending || sent) return
    const targetAddr = selectedUser.address
    // Read DOM value directly to avoid stale React state on Android/Capacitor WebView
    const actualRequestMsg = requestMsgRef.current?.value ?? requestMsg
    setSending(true)
    try {
      const result = await sendFriendRequest(targetAddr, actualRequestMsg)
      setSent(true)
      const { default: toast } = await import('react-hot-toast')
      if (result.mode === 'accepted') {
        toast.success(t('friend.addedDirectly', locale))
      } else {
        toast.success(t('friend.requestSent', locale))
      }
    } catch (err) {
      const { default: toast } = await import('react-hot-toast')
      const { FriendPermissionError } = await import('@/lib/chat')
      if (err instanceof FriendPermissionError) {
        toast.error(t('friend.rejected', locale))
      } else if (err instanceof Error && err.message === 'ALREADY_FRIENDS') {
        toast.error(t('friend.alreadyFriends', locale))
      } else if (err instanceof Error && err.message === 'ALREADY_PENDING') {
        toast.error(t('friend.alreadyPending', locale))
        setSent(true)
      } else {
        toast.error(t('friend.sendFailed', locale))
      }
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
    setSearchResults([])
    setSelectedUser(null)
    setSearchError(null)
    setSent(false)
    setRequestMsg('')
    setShowMsgInput(false)
    onClose()
  }

  const handleSelectUser = (user: SelectedUser) => {
    setSelectedUser(user)
    setSent(false)
    setRequestMsg('')
    setShowMsgInput(false)
  }

  // Render the friend request action area for a selected user
  const renderActionArea = () => {
    if (!selectedUser) return null

    const isFriend = isAlreadyFriend(selectedUser.address)
    const isSent = isAlreadySent(selectedUser.address)

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-muted/50 rounded-xl p-4 space-y-3"
      >
        {/* User info */}
        {selectedUser.nickname ? (
          <div className="flex items-center gap-3">
            <img
              src={selectedUser.avatarUrl || DEFAULT_AVATAR_SVG}
              alt=""
              className="w-10 h-10 rounded-full object-cover bg-muted"
              onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{selectedUser.nickname}</p>
              <p className="text-xs text-muted-foreground">{`${selectedUser.address.slice(0, 6)}...${selectedUser.address.slice(-4)}`}</p>
            </div>
          </div>
        ) : (
          <WalletAddress address={normalizedAddr || selectedUser.address} />
        )}

        {isFriend ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const c = chats.find((c) => c.walletAddress?.toLowerCase() === selectedUser.address.toLowerCase())
              if (c) handleOpenChat(c)
            }}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground rounded-xl px-4 py-2.5 text-sm font-medium"
          >
            <MessageCircle className="w-4 h-4" />
            {t('chat.sendMessageTo', locale)}
          </motion.button>
        ) : isSent || sent ? (
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
                  ref={requestMsgRef}
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
    )
  }

  // Is this a nickname search (multi-result mode)?
  const isNicknameSearch = searchResults.length > 0 && !ADDRESS_REGEX.test(searchText.trim())

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
                  ref={searchInputCallbackRef}
                  type="text"
                  onPaste={(e) => {
                    // Explicit paste handler for Android IME compatibility:
                    // some IME implementations bypass the native input event on paste.
                    const text = e.clipboardData?.getData('text') || ''
                    if (text.trim()) setTimeout(() => setSearchInput(text.trim()), 0)
                  }}
                  placeholder={t('chat.searchByAddress', locale)}
                  className="w-full bg-muted rounded-xl pl-9 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                  autoFocus
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                )}
                {!searching && !searchText && (
                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    onClick={handlePasteButton}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                    aria-label={t('chat.pasteAddress', locale)}
                    title={t('chat.pasteAddress', locale)}
                    type="button"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                  </motion.button>
                )}
              </div>

              {/* Error state */}
              {searchError && (
                <p className="text-sm text-[var(--ogbo-red)] text-center">{searchError}</p>
              )}

              {/* Nickname search results list (multi-result) */}
              {isNicknameSearch && !selectedUser && searchResults.length > 0 && !searchError && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  {searchResults.map((user) => {
                    const isFriend = isAlreadyFriend(user.address)
                    return (
                      <motion.button
                        key={user.address}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-2.5 text-left hover:bg-muted transition-colors"
                      >
                        <img
                          src={user.avatarUrl || DEFAULT_AVATAR_SVG}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover bg-muted flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_AVATAR_SVG }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{user.nickname}</p>
                          <p className="text-xs text-muted-foreground">{`${user.address.slice(0, 6)}...${user.address.slice(-4)}`}</p>
                        </div>
                        {isFriend && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}

              {/* Selected user action area (or address search single result) */}
              {selectedUser && !searchError && renderActionArea()}

              {/* Back button for nickname search when user is selected */}
              {isNicknameSearch && selectedUser && searchResults.length > 1 && (
                <button
                  onClick={() => { setSelectedUser(null); setSent(false); setRequestMsg(''); setShowMsgInput(false) }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  &larr; {t('chat.searchContacts', locale)}
                </button>
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
