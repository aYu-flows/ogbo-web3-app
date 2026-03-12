'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Crown, Shield, MicOff, Loader2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import UserAvatar from '@/components/UserAvatar'
import MuteMemberModal from '@/components/chat/MuteMemberModal'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import type {
  GroupDetail,
  GroupMemberRow,
  GroupMuteRow,
  GroupRole,
} from '@/lib/group-management'

interface GroupMemberListProps {
  open: boolean
  onClose: () => void
  groupId: string
  groupDetail: GroupDetail | null
}

interface MemberEntry {
  wallet: string
  role: GroupRole
  joinedAt: string
  isMuted: boolean
}

export default function GroupMemberList({
  open,
  onClose,
  groupId,
  groupDetail,
}: GroupMemberListProps) {
  const { locale, walletAddress, getDisplayName, setAdmin, unsetAdmin, kickMember } = useStore()

  const [members, setMembers] = useState<GroupMemberRow[]>([])
  const [mutes, setMutes] = useState<GroupMuteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionMenuTarget, setActionMenuTarget] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmKick, setConfirmKick] = useState<string | null>(null)
  const [muteTarget, setMuteTarget] = useState<{ wallet: string; name: string } | null>(null)

  // Fetch members and mutes when opened
  useEffect(() => {
    if (!open || !groupId) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const { fetchGroupMembers } = await import('@/lib/group-management')
        const { supabase } = await import('@/lib/supabaseClient')

        const [memberData, muteData] = await Promise.all([
          fetchGroupMembers(groupId),
          supabase
            .from('group_mutes')
            .select('*')
            .eq('group_id', groupId)
            .then(({ data }) => (data ?? []) as GroupMuteRow[]),
        ])

        if (!cancelled) {
          setMembers(memberData)
          setMutes(muteData)
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open, groupId])

  // Build sorted member list
  const sortedMembers = useMemo<MemberEntry[]>(() => {
    if (!groupDetail) return []

    const now = new Date()
    const activeMutes = new Set(
      mutes
        .filter((m) => m.mute_until === null || new Date(m.mute_until) > now)
        .map((m) => m.wallet_address.toLowerCase()),
    )

    const memberMap = new Map<string, GroupMemberRow>()
    for (const m of members) {
      memberMap.set(m.wallet_address.toLowerCase(), m)
    }

    const entries: MemberEntry[] = groupDetail.members.map((wallet) => {
      const w = wallet.toLowerCase()
      const isOwner = groupDetail.creator.toLowerCase() === w
      const isAdmin = groupDetail.admins.some((a) => a.toLowerCase() === w)
      const role: GroupRole = isOwner ? 'owner' : isAdmin ? 'admin' : 'member'
      const row = memberMap.get(w)

      return {
        wallet: w,
        role,
        joinedAt: row?.joined_at ?? '',
        isMuted: activeMutes.has(w),
      }
    })

    // Sort: owner first, then admins, then members, then by joinedAt
    const roleOrder: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 }
    entries.sort((a, b) => {
      const ro = roleOrder[a.role] - roleOrder[b.role]
      if (ro !== 0) return ro
      return (a.joinedAt || '').localeCompare(b.joinedAt || '')
    })

    return entries
  }, [groupDetail, members, mutes])

  // Filter by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return sortedMembers
    const q = searchQuery.trim().toLowerCase()
    return sortedMembers.filter((m) => {
      const name = getDisplayName(m.wallet).toLowerCase()
      return name.includes(q) || m.wallet.includes(q)
    })
  }, [sortedMembers, searchQuery, getDisplayName])

  // My role
  const myRole = useMemo<GroupRole>(() => {
    if (!groupDetail || !walletAddress) return 'member'
    const w = walletAddress.toLowerCase()
    if (groupDetail.creator.toLowerCase() === w) return 'owner'
    if (groupDetail.admins.some((a) => a.toLowerCase() === w)) return 'admin'
    return 'member'
  }, [groupDetail, walletAddress])

  const adminCount = groupDetail?.admins.length ?? 0

  // Action handlers
  const handleSetAdmin = useCallback(
    async (wallet: string) => {
      setActionLoading(true)
      try {
        await setAdmin(groupId, wallet)
        setActionMenuTarget(null)
      } catch {
        // error handled inside store
      } finally {
        setActionLoading(false)
      }
    },
    [groupId, setAdmin],
  )

  const handleUnsetAdmin = useCallback(
    async (wallet: string) => {
      setActionLoading(true)
      try {
        await unsetAdmin(groupId, wallet)
        setActionMenuTarget(null)
      } catch {
        // error handled inside store
      } finally {
        setActionLoading(false)
      }
    },
    [groupId, unsetAdmin],
  )

  const handleKickConfirmed = useCallback(
    async (wallet: string) => {
      setActionLoading(true)
      try {
        await kickMember(groupId, wallet)
        setConfirmKick(null)
        setActionMenuTarget(null)
        // Remove from local state
        setMembers((prev) => prev.filter((m) => m.wallet_address.toLowerCase() !== wallet.toLowerCase()))
      } catch {
        // error handled inside store
      } finally {
        setActionLoading(false)
      }
    },
    [groupId, kickMember],
  )

  const handleOpenMute = useCallback(
    (wallet: string) => {
      setMuteTarget({ wallet, name: getDisplayName(wallet) })
      setActionMenuTarget(null)
    },
    [getDisplayName],
  )

  // Build context menu actions for a member
  const getActions = (entry: MemberEntry) => {
    const isSelf = walletAddress?.toLowerCase() === entry.wallet
    if (isSelf || myRole === 'member') return []

    const actions: { label: string; action: () => void; destructive?: boolean }[] = []

    if (myRole === 'owner') {
      if (entry.role === 'admin') {
        actions.push({
          label: t('group.removeAdmin', locale),
          action: () => handleUnsetAdmin(entry.wallet),
        })
      } else if (entry.role === 'member') {
        actions.push({
          label: t('group.setAdmin', locale),
          action: () => handleSetAdmin(entry.wallet),
        })
      }
    }

    if (entry.role !== 'owner') {
      if (myRole === 'owner' || (myRole === 'admin' && entry.role === 'member')) {
        actions.push({
          label: t('group.muteMember', locale),
          action: () => handleOpenMute(entry.wallet),
        })
        actions.push({
          label: t('group.removeMember', locale),
          action: () => setConfirmKick(entry.wallet),
          destructive: true,
        })
      }
    }

    return actions
  }

  const handleClose = () => {
    setSearchQuery('')
    setActionMenuTarget(null)
    setConfirmKick(null)
    onClose()
  }

  return (
    <>
      <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
        <DrawerContent className="h-[85vh] flex flex-col">
          <DrawerHeader className="flex-shrink-0 border-b border-border">
            <div className="flex items-center justify-between">
              <DrawerTitle>{t('group.members', locale)}</DrawerTitle>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </DrawerHeader>

          <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
            {/* Search bar */}
            <div className="relative my-3 flex-shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={locale === 'zh' ? '搜索成员' : 'Search members'}
                className="w-full bg-muted rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
              />
            </div>

            {/* Admin count header */}
            <div className="flex-shrink-0 mb-2">
              <p className="text-xs text-muted-foreground font-medium">
                {t('group.role.admin', locale)} {adminCount}/10
              </p>
            </div>

            {/* Member list */}
            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {filteredMembers.map((entry) => {
                  const displayName = getDisplayName(entry.wallet)
                  const actions = getActions(entry)
                  const isMenuOpen = actionMenuTarget === entry.wallet

                  return (
                    <div key={entry.wallet} className="relative">
                      <button
                        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors text-left hover:bg-muted/60"
                        onClick={() => {
                          if (actions.length > 0) {
                            setActionMenuTarget(isMenuOpen ? null : entry.wallet)
                          }
                        }}
                      >
                        {/* Avatar */}
                        <UserAvatar address={entry.wallet} size="sm" />

                        {/* Name + wallet */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium truncate">{displayName}</p>
                            {entry.role === 'owner' && (
                              <Crown className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                            )}
                            {entry.role === 'admin' && (
                              <Shield className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                            )}
                            {entry.isMuted && (
                              <MicOff className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate font-mono">
                            {entry.wallet.slice(0, 6)}...{entry.wallet.slice(-4)}
                          </p>
                        </div>
                      </button>

                      {/* Action menu */}
                      {isMenuOpen && actions.length > 0 && (
                        <div className="absolute right-3 top-full z-10 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
                          {actions.map((act) => (
                            <button
                              key={act.label}
                              disabled={actionLoading}
                              onClick={(e) => {
                                e.stopPropagation()
                                act.action()
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-muted disabled:opacity-50 ${
                                act.destructive ? 'text-red-500' : ''
                              }`}
                            >
                              {actionLoading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-2" />
                              ) : null}
                              {act.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {filteredMembers.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {locale === 'zh' ? '没有匹配的成员' : 'No matching members'}
                  </p>
                )}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirm kick dialog */}
      {confirmKick && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmKick(null)} />
          <div className="relative bg-card rounded-2xl shadow-xl w-full max-w-xs p-5 space-y-4">
            <p className="text-sm text-center">
              {t('group.removeMemberConfirm', locale).replace('{name}', getDisplayName(confirmKick))}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmKick(null)}
                disabled={actionLoading}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
              >
                {locale === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={() => handleKickConfirmed(confirmKick)}
                disabled={actionLoading}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {locale === 'zh' ? '确认' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mute modal */}
      {muteTarget && (
        <MuteMemberModal
          open={!!muteTarget}
          onClose={() => setMuteTarget(null)}
          groupId={groupId}
          targetWallet={muteTarget.wallet}
          targetName={muteTarget.name}
        />
      )}
    </>
  )
}
