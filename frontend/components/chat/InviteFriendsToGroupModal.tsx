'use client'

import { useState, useMemo } from 'react'
import { Search, Users, Loader2, Check } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useIMEInput } from '@/hooks/use-ime-input'
import { t } from '@/lib/i18n'
import UserAvatar from '@/components/UserAvatar'
import toast from 'react-hot-toast'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'

interface InviteFriendsToGroupModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  existingMembers: string[]
}

export default function InviteFriendsToGroupModal({
  open,
  onClose,
  groupId,
  existingMembers,
}: InviteFriendsToGroupModalProps) {
  const { locale, chats, getDisplayName, inviteFriendsToGroupAction } = useStore()
  const { value: searchQuery, setValue: setSearchQuery, deferredValue: deferredSearch, getInputProps: getSearchInputProps } = useIMEInput('')
  const [selectedWallets, setSelectedWallets] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Normalize existing members for comparison
  const existingSet = useMemo(
    () => new Set(existingMembers.map((m) => m.toLowerCase())),
    [existingMembers],
  )

  // Get personal chats (friends) that are not already in the group
  const availableFriends = useMemo(() => {
    return chats.filter((c) => {
      if (c.type !== 'personal') return false
      if (!c.walletAddress) return false
      return !existingSet.has(c.walletAddress.toLowerCase())
    })
  }, [chats, existingSet])

  // Filter by search
  const filteredFriends = useMemo(() => {
    if (!deferredSearch.trim()) return availableFriends
    const q = deferredSearch.trim().toLowerCase()
    return availableFriends.filter((f) => {
      const name = f.walletAddress ? getDisplayName(f.walletAddress).toLowerCase() : f.name.toLowerCase()
      return name.includes(q) || (f.walletAddress?.toLowerCase().includes(q) ?? false)
    })
  }, [availableFriends, deferredSearch, getDisplayName])

  const toggleSelect = (address: string) => {
    setSelectedWallets((prev) =>
      prev.includes(address) ? prev.filter((a) => a !== address) : [...prev, address],
    )
  }

  const handleInvite = async () => {
    if (selectedWallets.length === 0 || loading) return
    setLoading(true)
    try {
      await inviteFriendsToGroupAction(groupId, selectedWallets)
      toast.success(locale === 'zh' ? '邀请已发送' : 'Invitations sent')
      setSelectedWallets([])
      setSearchQuery('')
      onClose()
    } catch {
      toast.error(locale === 'zh' ? '邀请失败，请重试' : 'Invite failed, please retry')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setSelectedWallets([])
    setSearchQuery('')
    onClose()
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent className="h-[80vh] flex flex-col">
        <DrawerHeader className="flex-shrink-0 border-b border-border">
          <DrawerTitle>{t('group.inviteFriends', locale)}</DrawerTitle>
        </DrawerHeader>

        <div className="flex-1 flex flex-col overflow-hidden px-4">
          {/* Search bar */}
          <div className="relative my-3 flex-shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              {...getSearchInputProps()}
              placeholder={locale === 'zh' ? '搜索好友' : 'Search friends'}
              className="w-full bg-muted rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
              disabled={loading}
            />
          </div>

          {/* Selected count */}
          {selectedWallets.length > 0 && (
            <p className="text-xs text-[var(--ogbo-blue)] font-medium mb-2 flex-shrink-0">
              {locale === 'zh'
                ? `已选择 ${selectedWallets.length} 人`
                : `${selectedWallets.length} selected`}
            </p>
          )}

          {/* Friend list */}
          {availableFriends.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
              <Users className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                {locale === 'zh' ? '没有可邀请的好友' : 'No friends to invite'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-0.5">
              {filteredFriends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {locale === 'zh' ? '没有匹配的好友' : 'No matching friends'}
                </p>
              ) : (
                filteredFriends.map((friend) => {
                  const addr = friend.walletAddress!
                  const isSelected = selectedWallets.includes(addr)

                  return (
                    <button
                      key={friend.id}
                      onClick={() => !loading && toggleSelect(addr)}
                      disabled={loading}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left ${
                        isSelected
                          ? 'bg-[var(--ogbo-blue)]/10'
                          : 'hover:bg-muted/60'
                      }`}
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
                      <UserAvatar address={addr} size="sm" />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {getDisplayName(addr)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {addr.slice(0, 6)}...{addr.slice(-4)}
                        </p>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          )}
        </div>

        <DrawerFooter className="flex-shrink-0 border-t border-border">
          <button
            onClick={handleInvite}
            disabled={selectedWallets.length === 0 || loading}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-40 transition-all"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {locale === 'zh' ? '邀请中...' : 'Inviting...'}
              </>
            ) : (
              <>
                <Users className="w-4 h-4" />
                {t('group.inviteFriends', locale)}
                {selectedWallets.length > 0 && ` (${selectedWallets.length})`}
              </>
            )}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
