'use client'

import { useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { toast } from '@/hooks/use-toast'
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
import { updateGroupSettings, type GroupDetail, type JoinMode } from '@/lib/group-management'

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

  const [joinModeLoading, setJoinModeLoading] = useState(false)
  const [inviteApprovalLoading, setInviteApprovalLoading] = useState(false)
  const [muteAllLoading, setMuteAllLoading] = useState(false)

  const currentJoinMode = groupDetail?.join_mode ?? 'free'
  const currentInviteApproval = groupDetail?.invite_approval ?? false
  const currentMuteAll = groupDetail?.mute_all ?? false

  const joinModeOptions: { value: JoinMode; labelKey: string }[] = [
    { value: 'free', labelKey: 'group.joinMode.free' },
    { value: 'approval', labelKey: 'group.joinMode.approval' },
    { value: 'disabled', labelKey: 'group.joinMode.disabled' },
  ]

  const handleJoinModeChange = async (value: string) => {
    if (joinModeLoading || value === currentJoinMode) return
    setJoinModeLoading(true)
    try {
      await updateGroupSettings(groupId, { join_mode: value as JoinMode })
      toast({ title: t('common.updated', locale) })
    } catch {
      toast({ title: t('group.error.operationFailed', locale), variant: 'destructive' })
    } finally {
      setJoinModeLoading(false)
    }
  }

  const handleInviteApprovalToggle = async (checked: boolean) => {
    if (inviteApprovalLoading) return

    // When toggling OFF (from approval to no-approval), warn about auto-approving pending requests
    if (!checked && currentInviteApproval) {
      toast({
        title: locale === 'zh'
          ? '关闭后，待处理的邀请请求将被自动通过'
          : 'Pending invite requests will be auto-approved when disabled',
      })
    }

    setInviteApprovalLoading(true)
    try {
      await updateGroupSettings(groupId, { invite_approval: checked })
      toast({ title: t('common.updated', locale) })
    } catch {
      toast({ title: t('group.error.operationFailed', locale), variant: 'destructive' })
    } finally {
      setInviteApprovalLoading(false)
    }
  }

  const handleMuteAllToggle = async (checked: boolean) => {
    if (muteAllLoading) return
    setMuteAllLoading(true)
    try {
      await updateGroupSettings(groupId, { mute_all: checked })
      toast({
        title: checked
          ? t('group.muteAll', locale)
          : t('group.unmuteAll', locale),
      })
    } catch {
      toast({ title: t('group.error.operationFailed', locale), variant: 'destructive' })
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
              value={currentJoinMode}
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
                checked={currentInviteApproval}
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
                {currentMuteAll
                  ? t('group.unmuteAll', locale)
                  : t('group.muteAll', locale)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {muteAllLoading && (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={currentMuteAll}
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
