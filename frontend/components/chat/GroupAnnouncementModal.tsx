'use client'

import { useState, useEffect } from 'react'
import { Loader2, Megaphone } from 'lucide-react'
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
import {
  setGroupAnnouncement,
  updateMyGroupSettings,
  type GroupDetail,
} from '@/lib/group-management'

interface GroupAnnouncementModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  groupDetail: GroupDetail | null
  canEdit: boolean
  isUnread?: boolean
}

const MAX_ANNOUNCEMENT_LENGTH = 500

export default function GroupAnnouncementModal({
  open,
  onClose,
  groupId,
  groupDetail,
  canEdit,
  isUnread,
}: GroupAnnouncementModalProps) {
  const locale = useStore((s) => s.locale)
  const walletAddress = useStore((s) => s.walletAddress)
  const getDisplayName = useStore((s) => s.getDisplayName)

  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)

  const announcement = groupDetail?.announcement ?? null
  const announcementBy = groupDetail?.announcement_by ?? null
  const announcementAt = groupDetail?.announcement_at ?? null

  // Reset editing state when modal opens/closes
  useEffect(() => {
    if (open) {
      setIsEditing(false)
      setEditText(announcement ?? '')
    }
  }, [open, announcement])

  const handleClose = async () => {
    // If this was an unread announcement notification, mark it as read
    if (isUnread && walletAddress && announcement) {
      try {
        await updateMyGroupSettings(groupId, walletAddress, {
          last_read_announcement_at: new Date().toISOString(),
        })
      } catch {
        // silent fail for marking read
      }
    }
    onClose()
  }

  const handleStartEdit = () => {
    setEditText(announcement ?? '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (saving || !walletAddress) return
    const trimmed = editText.trim()

    setSaving(true)
    try {
      await setGroupAnnouncement(groupId, trimmed, walletAddress)
      toast({ title: t('group.announcementUpdated', locale) })
      setIsEditing(false)
    } catch {
      toast({ title: t('group.error.operationFailed', locale), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return isoStr
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && handleClose()}>
      <DrawerContent className="bg-card border-border">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[var(--ogbo-blue)]" />
            {t('group.announcement', locale)}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            {t('group.announcement', locale)}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-4">
          {isEditing ? (
            /* ─── Edit Mode ─── */
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={editText}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_ANNOUNCEMENT_LENGTH) {
                      setEditText(e.target.value)
                    }
                  }}
                  placeholder={
                    locale === 'zh' ? '输入群公告内容...' : 'Enter announcement...'
                  }
                  maxLength={MAX_ANNOUNCEMENT_LENGTH}
                  rows={5}
                  className="w-full bg-muted rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
                  disabled={saving}
                />
                <p className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                  {editText.length}/{MAX_ANNOUNCEMENT_LENGTH}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                >
                  {t('common.cancel', locale)}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-[var(--ogbo-blue)] text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.save', locale)}
                </button>
              </div>
            </div>
          ) : announcement ? (
            /* ─── View Mode with existing announcement ─── */
            <div className="space-y-3">
              {/* Unread badge */}
              {isUnread && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--ogbo-blue)]/10 px-3 py-1 text-xs font-medium text-[var(--ogbo-blue)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--ogbo-blue)] animate-pulse" />
                  {locale === 'zh' ? '新公告' : 'New'}
                </div>
              )}

              {/* Announcement text */}
              <div className="bg-muted/50 rounded-xl px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {announcement}
                </p>
              </div>

              {/* Publisher info */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {announcementBy
                    ? `${locale === 'zh' ? '发布者: ' : 'By: '}${getDisplayName(announcementBy)}`
                    : ''}
                </span>
                <span>
                  {announcementAt ? formatTime(announcementAt) : ''}
                </span>
              </div>

              {/* Edit button */}
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
                >
                  {t('group.editAnnouncement', locale)}
                </button>
              )}
            </div>
          ) : (
            /* ─── No announcement placeholder ─── */
            <div className="flex flex-col items-center gap-3 py-8">
              <Megaphone className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {t('group.noAnnouncement', locale)}
              </p>
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold bg-[var(--ogbo-blue)] text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors"
                >
                  {t('group.editAnnouncement', locale)}
                </button>
              )}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
