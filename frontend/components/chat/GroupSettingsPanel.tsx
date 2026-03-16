'use client'

import { useState, useEffect } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import hotToast from 'react-hot-toast'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { type GroupDetail, type JoinMode } from '@/lib/group-management'

interface GroupSettingsPanelProps {
  open: boolean
  onClose: () => void
  groupId: string
  groupDetail: GroupDetail | null
}

export default function GroupSettingsPanel({
  open,
  onClose,
  groupId,
  groupDetail,
}: GroupSettingsPanelProps) {
  const locale = useStore((s) => s.locale)
  const toggleMuteAll = useStore((s) => s.toggleMuteAll)
  const updateJoinMode = useStore((s) => s.updateJoinMode)
  const toggleInviteApproval = useStore((s) => s.toggleInviteApproval)

  const [joinModeLoading, setJoinModeLoading] = useState(false)
  const [inviteApprovalLoading, setInviteApprovalLoading] = useState(false)
  const [muteAllLoading, setMuteAllLoading] = useState(false)

  const [localJoinMode, setLocalJoinMode] = useState<JoinMode>(groupDetail?.join_mode ?? 'free')
  const [localInviteApproval, setLocalInviteApproval] = useState(groupDetail?.invite_approval ?? false)
  const [localMuteAll, setLocalMuteAll] = useState(groupDetail?.mute_all ?? false)

  useEffect(() => {
    setLocalMuteAll(groupDetail?.mute_all ?? false)
    setLocalJoinMode(groupDetail?.join_mode ?? 'free')
    setLocalInviteApproval(groupDetail?.invite_approval ?? false)
  }, [groupDetail?.mute_all, groupDetail?.join_mode, groupDetail?.invite_approval])

  const joinModeOptions: { value: JoinMode; labelKey: string }[] = [
    { value: 'free', labelKey: 'group.joinMode.free' },
    { value: 'approval', labelKey: 'group.joinMode.approval' },
    { value: 'disabled', labelKey: 'group.joinMode.disabled' },
  ]

  const handleJoinModeChange = async (value: string) => {
    const newMode = value as JoinMode
    if (joinModeLoading || newMode === localJoinMode) return
    setLocalJoinMode(newMode)
    setJoinModeLoading(true)
    try {
      await updateJoinMode(groupId, newMode)
      hotToast.success(t('common.updated', locale))
    } catch {
      setLocalJoinMode(groupDetail?.join_mode ?? 'free')
      hotToast.error(t('group.error.operationFailed', locale))
    } finally {
      setJoinModeLoading(false)
    }
  }

  const handleInviteApprovalToggle = async (checked: boolean) => {
    if (inviteApprovalLoading) return

    // When toggling OFF (from approval to no-approval), warn about auto-approving pending requests
    if (!checked && localInviteApproval) {
      hotToast(locale === 'zh'
        ? '关闭后，待处理的邀请请求将被自动通过'
        : 'Pending invite requests will be auto-approved when disabled',
        { icon: '\u2139\uFE0F' }
      )
    }

    setLocalInviteApproval(checked)
    setInviteApprovalLoading(true)
    try {
      await toggleInviteApproval(groupId)
      hotToast.success(t('common.updated', locale))
    } catch {
      setLocalInviteApproval(groupDetail?.invite_approval ?? false)
      hotToast.error(t('group.error.operationFailed', locale))
    } finally {
      setInviteApprovalLoading(false)
    }
  }

  const handleMuteAllToggle = async (checked: boolean) => {
    if (muteAllLoading) return
    setLocalMuteAll(checked)
    setMuteAllLoading(true)
    try {
      await toggleMuteAll(groupId)
      hotToast.success(checked
        ? t('group.muteAll', locale)
        : t('group.unmuteAll', locale))
    } catch {
      setLocalMuteAll(groupDetail?.mute_all ?? false)
      hotToast.error(t('group.error.operationFailed', locale))
    } finally {
      setMuteAllLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="bg-card border-border">
        <DrawerHeader className="text-left">
          <DrawerTitle>{t('group.settings', locale)}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {t('group.settings', locale)}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Join Mode */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">
              {t('group.joinMode', locale)}
            </p>
            <RadioGroup
              value={localJoinMode}
              onValueChange={handleJoinModeChange}
              disabled={joinModeLoading}
              className="space-y-2"
            >
              {joinModeOptions.map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5"
                >
                  <RadioGroupItem value={opt.value} id={`join-mode-${opt.value}`} />
                  <Label
                    htmlFor={`join-mode-${opt.value}`}
                    className="flex-1 text-sm cursor-pointer"
                  >
                    {t(opt.labelKey, locale)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {joinModeLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                {t('common.loading', locale)}
              </div>
            )}
          </div>

          {/* Invite Approval */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t('group.inviteApproval', locale)}</p>
            </div>
            <div className="flex items-center gap-2">
              {inviteApprovalLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={localInviteApproval}
                onCheckedChange={handleInviteApprovalToggle}
                disabled={inviteApprovalLoading}
              />
            </div>
          </div>

          {/* Mute All */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm font-medium">
                {localMuteAll
                  ? t('group.unmuteAll', locale)
                  : t('group.muteAll', locale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {muteAllLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={localMuteAll}
                onCheckedChange={handleMuteAllToggle}
                disabled={muteAllLoading}
              />
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
