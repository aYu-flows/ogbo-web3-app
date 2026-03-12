'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import type { GroupDetail, GroupRole } from '@/lib/group-management'
import { getGroupRole } from '@/lib/group-management'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Crown,
  Shield,
  Users,
  Bell,
  BellOff,
  Pin,
  LogOut,
  Settings,
  Link2,
  ClipboardList,
  UserPlus,
  Trash2,
  ChevronRight,
  X,
} from 'lucide-react'
import UserAvatar from '@/components/UserAvatar'
import { addressToColor } from '@/lib/chat'

interface GroupInfoPanelProps {
  open: boolean
  onClose: () => void
  groupId: string
  onOpenMemberList: () => void
  onOpenSettings: () => void
  onOpenAnnouncement: () => void
  onOpenInviteLink: () => void
  onOpenJoinRequests: () => void
  onOpenInviteFriends: () => void
  onOpenTransferOwner: () => void
}

export default function GroupInfoPanel({
  open,
  onClose,
  groupId,
  onOpenMemberList,
  onOpenSettings,
  onOpenAnnouncement,
  onOpenInviteLink,
  onOpenJoinRequests,
  onOpenInviteFriends,
  onOpenTransferOwner,
}: GroupInfoPanelProps) {
  const walletAddress = useStore((s) => s.walletAddress)
  const locale = useStore((s) => s.locale)
  const myGroupSettings = useStore((s) => s.myGroupSettings)
  const pendingRequestCounts = useStore((s) => s.pendingRequestCounts)
  const getDisplayName = useStore((s) => s.getDisplayName)
  const openGroupManagement = useStore((s) => s.openGroupManagement)
  const toggleGroupPin = useStore((s) => s.toggleGroupPin)
  const toggleGroupDND = useStore((s) => s.toggleGroupDND)
  const updateGroupNameAction = useStore((s) => s.updateGroupNameAction)
  const updateGroupNickname = useStore((s) => s.updateGroupNickname)
  const leaveGroupAction = useStore((s) => s.leaveGroupAction)
  const dissolveGroupAction = useStore((s) => s.dissolveGroupAction)

  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<GroupRole>('member')

  // Inline edit states
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const [editingNickname, setEditingNickname] = useState(false)
  const [nicknameValue, setNicknameValue] = useState('')
  const [savingNickname, setSavingNickname] = useState(false)
  const nicknameInputRef = useRef<HTMLInputElement>(null)

  // Toggle loading states
  const [togglingPin, setTogglingPin] = useState(false)
  const [togglingDND, setTogglingDND] = useState(false)

  // Confirm dialogs
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showDissolveConfirm, setShowDissolveConfirm] = useState(false)
  const [leavingGroup, setLeavingGroup] = useState(false)
  const [dissolvingGroup, setDissolvingGroup] = useState(false)

  const mySettings = myGroupSettings[groupId]
  const isPinned = mySettings?.pinned ?? false
  const isDND = mySettings?.muted_notifications ?? false
  const myNickname = mySettings?.group_nickname ?? ''
  const pendingCount = pendingRequestCounts[groupId] ?? 0

  // Fetch group detail on open
  useEffect(() => {
    if (!open || !groupId) return
    let cancelled = false

    setLoading(true)
    openGroupManagement(groupId).then((detail) => {
      if (cancelled) return
      setGroupDetail(detail)
      if (detail && walletAddress) {
        setRole(getGroupRole(detail, walletAddress))
      }
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [open, groupId, walletAddress, openGroupManagement])

  // Reset edit states when closing
  useEffect(() => {
    if (!open) {
      setEditingName(false)
      setEditingNickname(false)
      setGroupDetail(null)
      setLoading(true)
    }
  }, [open])

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  useEffect(() => {
    if (editingNickname) nicknameInputRef.current?.focus()
  }, [editingNickname])

  const isAdminOrOwner = role === 'owner' || role === 'admin'
  const isOwner = role === 'owner'

  // --- Handlers ---

  const handleSaveName = useCallback(async () => {
    if (!groupDetail || savingName) return
    const trimmed = (nameInputRef.current?.value ?? nameValue).trim()
    if (!trimmed || trimmed === groupDetail.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      await updateGroupNameAction(groupId, trimmed)
      setGroupDetail((prev) => (prev ? { ...prev, name: trimmed } : prev))
      setEditingName(false)
    } catch (err) {
      console.error('[GroupInfoPanel] save name failed:', err)
    } finally {
      setSavingName(false)
    }
  }, [groupDetail, nameValue, savingName, updateGroupNameAction, groupId])

  const handleSaveNickname = useCallback(async () => {
    if (savingNickname) return
    const trimmed = (nicknameInputRef.current?.value ?? nicknameValue).trim()
    if (trimmed === (myNickname || '')) {
      setEditingNickname(false)
      return
    }
    setSavingNickname(true)
    try {
      await updateGroupNickname(groupId, trimmed)
      setEditingNickname(false)
    } catch (err) {
      console.error('[GroupInfoPanel] save nickname failed:', err)
    } finally {
      setSavingNickname(false)
    }
  }, [nicknameValue, myNickname, savingNickname, updateGroupNickname, groupId])

  const handleTogglePin = useCallback(async () => {
    if (togglingPin) return
    setTogglingPin(true)
    try {
      await toggleGroupPin(groupId)
    } catch (err) {
      console.error('[GroupInfoPanel] toggle pin failed:', err)
    } finally {
      setTogglingPin(false)
    }
  }, [togglingPin, toggleGroupPin, groupId])

  const handleToggleDND = useCallback(async () => {
    if (togglingDND) return
    setTogglingDND(true)
    try {
      await toggleGroupDND(groupId)
    } catch (err) {
      console.error('[GroupInfoPanel] toggle DND failed:', err)
    } finally {
      setTogglingDND(false)
    }
  }, [togglingDND, toggleGroupDND, groupId])

  const handleLeave = useCallback(async () => {
    if (leavingGroup) return
    setLeavingGroup(true)
    try {
      await leaveGroupAction(groupId)
      setShowLeaveConfirm(false)
      onClose()
    } catch (err) {
      console.error('[GroupInfoPanel] leave group failed:', err)
    } finally {
      setLeavingGroup(false)
    }
  }, [leavingGroup, leaveGroupAction, groupId, onClose])

  const handleDissolve = useCallback(async () => {
    if (dissolvingGroup) return
    setDissolvingGroup(true)
    try {
      await dissolveGroupAction(groupId)
      setShowDissolveConfirm(false)
      onClose()
    } catch (err) {
      console.error('[GroupInfoPanel] dissolve group failed:', err)
    } finally {
      setDissolvingGroup(false)
    }
  }, [dissolvingGroup, dissolveGroupAction, groupId, onClose])

  // --- Render helpers ---

  const renderSkeleton = () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-32 rounded bg-white/10" />
          <div className="h-3 w-20 rounded bg-white/10" />
        </div>
      </div>
      <div className="h-16 rounded-xl bg-white/10" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-10 h-10 rounded-full bg-white/10" />
        ))}
      </div>
      <div className="space-y-2">
        <div className="h-12 rounded-xl bg-white/10" />
        <div className="h-12 rounded-xl bg-white/10" />
        <div className="h-12 rounded-xl bg-white/10" />
      </div>
    </div>
  )

  const renderMemberRoleIcon = (memberAddress: string) => {
    if (!groupDetail) return null
    const memberRole = getGroupRole(groupDetail, memberAddress)
    if (memberRole === 'owner') {
      return (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-yellow-500 flex items-center justify-center">
          <Crown className="w-2.5 h-2.5 text-black" />
        </div>
      )
    }
    if (memberRole === 'admin') {
      return (
        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
          <Shield className="w-2.5 h-2.5 text-white" />
        </div>
      )
    }
    return null
  }

  const renderRow = (
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    extra?: React.ReactNode,
    className?: string,
  ) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 transition-colors ${className ?? ''}`}
    >
      <span className="text-white/60">{icon}</span>
      <span className={`flex-1 text-left text-sm ${className?.includes('text-red') ? '' : 'text-white'}`}>
        {label}
      </span>
      {extra}
      <ChevronRight className="w-4 h-4 text-white/30" />
    </button>
  )

  const displayMembers = groupDetail?.members.slice(0, 8) ?? []
  const totalMembers = groupDetail?.members.length ?? 0
  const groupColor = groupDetail ? addressToColor(groupDetail.id) : '#6366f1'
  const groupInitial = groupDetail?.name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <>
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[90vh] bg-[#1a1a2e] border-white/10">
          <DrawerHeader className="relative pb-0">
            <DrawerTitle className="text-white text-center">
              {t('group.info', locale)}
            </DrawerTitle>
            <button
              onClick={onClose}
              className="absolute right-4 top-4 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-6 space-y-3">
            {loading ? (
              renderSkeleton()
            ) : groupDetail ? (
              <>
                {/* ── Header: Avatar + Name + Member Count ── */}
                <div className="flex items-center gap-3 pt-2">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 text-xl font-bold text-white"
                    style={{ backgroundColor: groupColor }}
                  >
                    {groupInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingName ? (
                      <input
                        ref={nameInputRef}
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onCompositionEnd={(e) => setNameValue(e.currentTarget.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName()
                          if (e.key === 'Escape') setEditingName(false)
                        }}
                        maxLength={50}
                        disabled={savingName}
                        className="w-full bg-white/10 text-white text-lg font-semibold rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          if (isAdminOrOwner) {
                            setNameValue(groupDetail.name)
                            setEditingName(true)
                          }
                        }}
                        className={`text-lg font-semibold text-white truncate block max-w-full text-left ${isAdminOrOwner ? 'hover:text-indigo-300 transition-colors' : ''}`}
                      >
                        {groupDetail.name}
                      </button>
                    )}
                    <div className="flex items-center gap-1 text-white/50 text-sm mt-0.5">
                      <Users className="w-3.5 h-3.5" />
                      <span>{totalMembers} {t('group.members', locale)}</span>
                    </div>
                  </div>
                </div>

                {/* ── Announcement Section ── */}
                <button
                  onClick={onOpenAnnouncement}
                  className="w-full rounded-xl bg-white/5 p-3 text-left hover:bg-white/10 transition-colors"
                >
                  <div className="text-xs text-white/50 mb-1">{t('group.announcement', locale)}</div>
                  {groupDetail.announcement ? (
                    <p className="text-sm text-white line-clamp-2">{groupDetail.announcement}</p>
                  ) : (
                    <p className="text-sm text-white/30">{t('group.noAnnouncement', locale)}</p>
                  )}
                </button>

                {/* ── Member Grid ── */}
                <div className="space-y-2">
                  <div className="grid grid-cols-5 gap-3">
                    {displayMembers.map((addr) => (
                      <div key={addr} className="flex flex-col items-center gap-1">
                        <div className="relative">
                          <UserAvatar address={addr} size="md" />
                          {renderMemberRoleIcon(addr)}
                        </div>
                        <span className="text-[10px] text-white/50 truncate w-full text-center">
                          {getDisplayName(addr)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={onOpenMemberList}
                    className="w-full flex items-center justify-center gap-1 py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    <Users className="w-4 h-4" />
                    {t('group.viewAllMembers', locale)} ({totalMembers})
                  </button>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-white/10" />

                {/* ── My Nickname ── */}
                <div className="rounded-xl bg-white/5 overflow-hidden">
                  {editingNickname ? (
                    <div className="flex items-center gap-2 px-4 py-3">
                      <span className="text-sm text-white/60 flex-shrink-0">{t('group.myNickname', locale)}</span>
                      <input
                        ref={nicknameInputRef}
                        value={nicknameValue}
                        onChange={(e) => setNicknameValue(e.target.value)}
                        onCompositionEnd={(e) => setNicknameValue(e.currentTarget.value)}
                        onBlur={handleSaveNickname}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveNickname()
                          if (e.key === 'Escape') setEditingNickname(false)
                        }}
                        placeholder={t('group.nicknamePlaceholder', locale)}
                        disabled={savingNickname}
                        className="flex-1 bg-transparent text-white text-sm outline-none text-right disabled:opacity-50"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setNicknameValue(myNickname || '')
                        setEditingNickname(true)
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="text-sm text-white flex-1 text-left">{t('group.myNickname', locale)}</span>
                      <span className="text-sm text-white/40 truncate max-w-[140px]">
                        {myNickname || t('group.nicknamePlaceholder', locale)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/30 flex-shrink-0" />
                    </button>
                  )}

                  {/* ── Pin Chat Toggle ── */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <Pin className="w-4 h-4 text-white/60" />
                      <span className="text-sm text-white">{t('group.pinChat', locale)}</span>
                    </div>
                    <Switch
                      checked={isPinned}
                      onCheckedChange={handleTogglePin}
                      disabled={togglingPin}
                      className={togglingPin ? 'opacity-50' : ''}
                    />
                  </div>

                  {/* ── DND Toggle ── */}
                  <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      {isDND ? (
                        <BellOff className="w-4 h-4 text-white/60" />
                      ) : (
                        <Bell className="w-4 h-4 text-white/60" />
                      )}
                      <span className="text-sm text-white">{t('group.dnd', locale)}</span>
                    </div>
                    <Switch
                      checked={isDND}
                      onCheckedChange={handleToggleDND}
                      disabled={togglingDND}
                      className={togglingDND ? 'opacity-50' : ''}
                    />
                  </div>
                </div>

                {/* ── Divider ── */}
                <div className="border-t border-white/10" />

                {/* ── Admin/Owner Section ── */}
                {isAdminOrOwner && (
                  <div className="rounded-xl bg-white/5 overflow-hidden">
                    {renderRow(
                      <UserPlus className="w-4 h-4" />,
                      t('group.inviteFriends', locale),
                      onOpenInviteFriends,
                    )}
                    {renderRow(
                      <Link2 className="w-4 h-4" />,
                      t('group.inviteLink', locale),
                      onOpenInviteLink,
                    )}
                    {renderRow(
                      <ClipboardList className="w-4 h-4" />,
                      t('group.joinRequests', locale),
                      onOpenJoinRequests,
                      pendingCount > 0 ? (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                          {pendingCount}
                        </span>
                      ) : undefined,
                    )}
                    {renderRow(
                      <Settings className="w-4 h-4" />,
                      t('group.settings', locale),
                      onOpenSettings,
                    )}
                  </div>
                )}

                {/* ── Owner Only Section ── */}
                {isOwner && (
                  <div className="rounded-xl bg-white/5 overflow-hidden">
                    {renderRow(
                      <Crown className="w-4 h-4" />,
                      t('group.transferOwnership', locale),
                      onOpenTransferOwner,
                    )}
                    <button
                      onClick={() => setShowDissolveConfirm(true)}
                      disabled={dissolvingGroup}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                      <span className="flex-1 text-left text-sm text-red-400">
                        {t('group.dissolveGroup', locale)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    </button>
                  </div>
                )}

                {/* ── Divider ── */}
                <div className="border-t border-white/10" />

                {/* ── Leave Group ── */}
                {isOwner ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-xl bg-white/5 text-white/30 text-sm text-center cursor-not-allowed"
                  >
                    {t('group.ownerCannotLeave', locale)}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowLeaveConfirm(true)}
                    disabled={leavingGroup}
                    className="w-full py-3 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 active:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center justify-center gap-2">
                      <LogOut className="w-4 h-4" />
                      {t('group.leaveGroup', locale)}
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="text-center text-white/40 py-8 text-sm">
                {t('group.error.operationFailed', locale)}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* ── Leave Group Confirm Dialog ── */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent className="bg-[#1a1a2e] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {t('group.leaveGroup', locale)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {t('group.leaveConfirm', locale)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={leavingGroup}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 hover:text-white"
            >
              {t('common.cancel', locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeave}
              disabled={leavingGroup}
              className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {leavingGroup ? '...' : t('group.leaveGroup', locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Dissolve Group Confirm Dialog ── */}
      <AlertDialog open={showDissolveConfirm} onOpenChange={setShowDissolveConfirm}>
        <AlertDialogContent className="bg-[#1a1a2e] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {t('group.dissolveGroup', locale)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              {t('group.dissolveConfirm', locale)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={dissolvingGroup}
              className="bg-white/10 text-white border-white/10 hover:bg-white/20 hover:text-white"
            >
              {t('common.cancel', locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDissolve}
              disabled={dissolvingGroup}
              className="bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
            >
              {dissolvingGroup ? '...' : t('group.dissolveGroup', locale)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
