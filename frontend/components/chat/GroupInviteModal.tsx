'use client'

import { useState, useEffect, useCallback } from 'react'
import { Copy, Loader2, Plus, Trash2, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { generateInviteUrl } from '@/lib/group-qrcode'
import { fetchInviteLinks } from '@/lib/group-management'
import type { GroupInviteRow } from '@/lib/group-management'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

interface GroupInviteModalProps {
  open: boolean
  onClose: () => void
  groupId: string
}

const EXPIRY_OPTIONS: { label: string; labelZh: string; value: number | null }[] = [
  { label: '1 day', labelZh: '1 天', value: 1 },
  { label: '7 days', labelZh: '7 天', value: 7 },
  { label: '30 days', labelZh: '30 天', value: 30 },
  { label: 'Never', labelZh: '永不过期', value: null },
]

export default function GroupInviteModal({ open, onClose, groupId }: GroupInviteModalProps) {
  const { createGroupInvite, revokeGroupInvite, locale } = useStore()
  const [links, setLinks] = useState<GroupInviteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expiryDays, setExpiryDays] = useState<number | null>(7)
  const [selectedLink, setSelectedLink] = useState<GroupInviteRow | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchInviteLinks(groupId)
      setLinks(data)
      if (data.length > 0 && !selectedLink) {
        setSelectedLink(data[0])
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [groupId, selectedLink])

  useEffect(() => {
    if (open) {
      setSelectedLink(null)
      setConfirmRevoke(null)
      loadLinks()
    }
  }, [open, groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const newLink = await createGroupInvite(groupId, expiryDays)
      setLinks((prev) => [newLink, ...prev])
      setSelectedLink(newLink)
    } catch {
      const toast = (await import('react-hot-toast')).default
      toast.error(locale === 'zh' ? '创建失败' : 'Failed to create link')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (link: GroupInviteRow) => {
    const url = generateInviteUrl(link.token)
    try {
      await navigator.clipboard.writeText(url)
      const toast = (await import('react-hot-toast')).default
      toast.success(locale === 'zh' ? '链接已复制' : 'Link copied')
    } catch {
      // clipboard failed
    }
  }

  const handleRevoke = async (inviteId: string) => {
    if (confirmRevoke !== inviteId) {
      setConfirmRevoke(inviteId)
      return
    }
    setRevoking(inviteId)
    try {
      await revokeGroupInvite(inviteId)
      setLinks((prev) => prev.filter((l) => l.id !== inviteId))
      if (selectedLink?.id === inviteId) {
        setSelectedLink(null)
      }
      setConfirmRevoke(null)
    } catch {
      const toast = (await import('react-hot-toast')).default
      toast.error(locale === 'zh' ? '撤销失败' : 'Failed to revoke')
    } finally {
      setRevoking(null)
    }
  }

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return locale === 'zh' ? '永不过期' : 'Never expires'
    const date = new Date(expiresAt)
    if (date < new Date()) return locale === 'zh' ? '已过期' : 'Expired'
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle>{locale === 'zh' ? '邀请链接' : 'Invite Links'}</DrawerTitle>
          <DrawerDescription>
            {locale === 'zh' ? '生成和管理群聊邀请链接' : 'Generate and manage group invite links'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Expiry selection */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <RadioGroup
              value={expiryDays === null ? 'null' : String(expiryDays)}
              onValueChange={(v) => setExpiryDays(v === 'null' ? null : Number(v))}
              className="flex flex-col"
            >
              {EXPIRY_OPTIONS.map((opt, idx) => (
                <label
                  key={String(opt.value)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    idx < EXPIRY_OPTIONS.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <RadioGroupItem value={opt.value === null ? 'null' : String(opt.value)} />
                  <span className="text-sm">{locale === 'zh' ? opt.labelZh : opt.label}</span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Generate button */}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full flex items-center justify-center gap-1.5 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-50 transition-colors"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {locale === 'zh' ? '生成链接' : 'New Link'}
          </button>

          {/* QR code for selected link */}
          {selectedLink && (
            <div className="flex flex-col items-center gap-3 bg-muted/50 rounded-xl p-4">
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG
                  value={generateInviteUrl(selectedLink.token)}
                  size={180}
                  level="M"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center break-all">
                {generateInviteUrl(selectedLink.token)}
              </p>
            </div>
          )}

          {/* Existing links */}
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : links.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {locale === 'zh' ? '暂无邀请链接' : 'No invite links yet'}
            </p>
          ) : (
            <div className="space-y-2">
              {links.map((link) => {
                const isSelected = selectedLink?.id === link.id
                const isExpired = link.expires_at && new Date(link.expires_at) < new Date()
                return (
                  <div
                    key={link.id}
                    onClick={() => setSelectedLink(link)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--ogbo-blue)]/10 ring-1 ring-[var(--ogbo-blue)]/30'
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-mono truncate ${isExpired ? 'text-muted-foreground line-through' : ''}`}>
                        {link.token.slice(0, 8)}...{link.token.slice(-4)}
                      </p>
                      <p className={`text-xs ${isExpired ? 'text-[var(--ogbo-red)]' : 'text-muted-foreground'}`}>
                        {formatExpiry(link.expires_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleCopy(link) }}
                        className="rounded-lg p-1.5 hover:bg-background/60 text-muted-foreground hover:text-foreground transition-colors"
                        title={locale === 'zh' ? '复制' : 'Copy'}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRevoke(link.id) }}
                        disabled={revoking === link.id}
                        className={`rounded-lg p-1.5 transition-colors ${
                          confirmRevoke === link.id
                            ? 'bg-[var(--ogbo-red)]/10 text-[var(--ogbo-red)]'
                            : 'hover:bg-background/60 text-muted-foreground hover:text-[var(--ogbo-red)]'
                        }`}
                        title={confirmRevoke === link.id
                          ? (locale === 'zh' ? '确认撤销' : 'Confirm revoke')
                          : (locale === 'zh' ? '撤销' : 'Revoke')
                        }
                      >
                        {revoking === link.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : confirmRevoke === link.id ? (
                          <X className="w-4 h-4" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
