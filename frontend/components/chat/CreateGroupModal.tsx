'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Users, Loader2, Check } from 'lucide-react'
import { useState, useMemo } from 'react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import type { Chat } from '@/lib/store'

interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  friends: Chat[]
}

export default function CreateGroupModal({ isOpen, onClose, friends }: CreateGroupModalProps) {
  const { createGroup, locale } = useStore()
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends
    const q = searchQuery.trim().toLowerCase()
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.walletAddress?.toLowerCase().includes(q)
    )
  }, [friends, searchQuery])

  const toggleSelect = (address: string) => {
    setSelectedAddresses((prev) =>
      prev.includes(address) ? prev.filter((a) => a !== address) : [...prev, address]
    )
  }

  const handleClose = () => {
    if (isCreating) return
    setSelectedAddresses([])
    setGroupName('')
    setSearchQuery('')
    onClose()
  }

  const handleCreate = async () => {
    if (selectedAddresses.length === 0 || isCreating) return
    setIsCreating(true)
    try {
      await createGroup(groupName, selectedAddresses)
      setSelectedAddresses([])
      setGroupName('')
      setSearchQuery('')
      onClose()
    } catch {
      // error toast handled inside createGroup
    } finally {
      setIsCreating(false)
    }
  }

  const selectedCountText = selectedAddresses.length > 0
    ? t('chat.selectedCount', locale).replace('{n}', String(selectedAddresses.length + 1))
    : null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%', scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: '100%', scale: 0.95 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative bg-card rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border">
              <h3 className="text-base font-semibold">{t('chat.createGroup', locale)}</h3>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
                disabled={isCreating}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Group name input */}
              <div>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t('chat.groupNamePlaceholder', locale)}
                  maxLength={50}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                  disabled={isCreating}
                />
              </div>

              {/* Select friends label + count */}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium">
                  {t('chat.selectFriends', locale)}
                </p>
                {selectedCountText && (
                  <p className="text-xs text-[var(--ogbo-blue)] font-medium">
                    {selectedCountText}
                  </p>
                )}
              </div>

              {/* Friend search */}
              {friends.length > 4 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={locale === 'zh' ? '搜索好友' : 'Search friends'}
                    className="w-full bg-muted rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                    disabled={isCreating}
                  />
                </div>
              )}

              {/* Friend list */}
              {friends.length === 0 ? (
                <div className="py-8 flex flex-col items-center gap-2">
                  <Users className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center">
                    {t('chat.noFriendsForGroup', locale)}
                  </p>
                </div>
              ) : filteredFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {locale === 'zh' ? '没有匹配的好友' : 'No matching friends'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredFriends.map((friend) => {
                    const addr = friend.walletAddress!
                    const isSelected = selectedAddresses.includes(addr)
                    return (
                      <motion.button
                        key={friend.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => !isCreating && toggleSelect(addr)}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left ${
                          isSelected
                            ? 'bg-[var(--ogbo-blue)]/10'
                            : 'hover:bg-muted/60'
                        }`}
                        disabled={isCreating}
                      >
                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected
                              ? 'bg-[var(--ogbo-blue)] border-[var(--ogbo-blue)]'
                              : 'border-border'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </div>

                        {/* Avatar */}
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                          style={{ backgroundColor: friend.avatarColor }}
                        >
                          {friend.name[0]?.toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{friend.name}</p>
                          {friend.walletAddress && (
                            <p className="text-xs text-muted-foreground truncate font-mono">
                              {friend.walletAddress.slice(0, 6)}...{friend.walletAddress.slice(-4)}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Create button */}
            <div className="px-5 pb-5">
              <motion.button
                whileHover={{ scale: selectedAddresses.length > 0 && !isCreating ? 1.02 : 1 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={selectedAddresses.length === 0 || isCreating}
                className="w-full flex items-center justify-center gap-2 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-40 transition-all"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('chat.creatingGroup', locale)}
                  </>
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    {t('chat.createGroup', locale)}
                    {selectedAddresses.length > 0 && ` (${selectedAddresses.length + 1})`}
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
