'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { setupInputPolling } from '@/hooks/use-ime-input'
import { Loader2, LogIn, ClipboardPaste, Users } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { parseInviteToken } from '@/lib/group-qrcode'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

interface JoinGroupModalProps {
  open: boolean
  onClose: () => void
}

export default function JoinGroupModal({ open, onClose }: JoinGroupModalProps) {
  const { joinGroupViaToken, locale } = useStore()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [invitePreview, setInvitePreview] = useState<{ name: string; memberCount: number; avatarUrl?: string; token: string } | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [inviteLinkInvalid, setInviteLinkInvalid] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pollingCleanupRef = useRef<(() => void) | null>(null)

  // Helper to set both DOM value and React state
  const setInputValue = useCallback((val: string) => {
    if (inputRef.current) inputRef.current.value = val
    setInput(val)
  }, [])

  // Callback ref with polling for Android IME compatibility
  const inputCallbackRef = useCallback((el: HTMLInputElement | null) => {
    if (pollingCleanupRef.current) {
      pollingCleanupRef.current()
      pollingCleanupRef.current = null
    }
    inputRef.current = el
    if (el) {
      pollingCleanupRef.current = setupInputPolling(el, (v) => setInput(v))
    }
  }, [])

  // Focus input after drawer open animation completes (avoid snap point jump from autoFocus)
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 300)
    return () => clearTimeout(timer)
  }, [open])

  // Detect invite link and load preview
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = input.trim()
    if (!trimmed) {
      setInvitePreview(null)
      setInviteLinkInvalid(false)
      setLoadingPreview(false)
      return
    }

    const token = parseInviteToken(trimmed)
    if (!token) {
      setInvitePreview(null)
      setInviteLinkInvalid(false)
      setLoadingPreview(false)
      return
    }

    let cancelled = false
    setLoadingPreview(true)
    setInviteLinkInvalid(false)

    debounceRef.current = setTimeout(() => {
      import('@/lib/group-management')
        .then(({ fetchGroupPreviewByToken }) => fetchGroupPreviewByToken(token))
        .then((preview) => {
          if (cancelled) return
          setLoadingPreview(false)
          if (preview) {
            setInvitePreview({ ...preview, token })
            setInviteLinkInvalid(false)
          } else {
            setInvitePreview(null)
            setInviteLinkInvalid(true)
          }
        })
        .catch(() => {
          if (cancelled) return
          setLoadingPreview(false)
          setInvitePreview(null)
          setInviteLinkInvalid(true)
        })
    }, 500)

    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input])

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setInvitePreview(null)
      setLoadingPreview(false)
      setInviteLinkInvalid(false)
    }
  }, [open])

  const handleClose = () => {
    if (loading) return
    setInputValue('')
    onClose()
  }

  const handlePaste = async () => {
    try {
      // Try Capacitor clipboard first on native
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          const { Clipboard } = await import('@capacitor/clipboard')
          const { value } = await Clipboard.read()
          if (value) {
            setInputValue(value.trim())
            return
          }
        }
      } catch {
        // Capacitor unavailable
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text.trim()) setInputValue(text.trim())
      }
    } catch {
      // silently fail
    }
  }

  const handleJoin = async () => {
    if (loading || !input.trim()) return
    const token = invitePreview?.token ?? parseInviteToken(input.trim())
    if (!token) {
      const toast = (await import('react-hot-toast')).default
      toast.error(locale === 'zh' ? '无效的邀请链接' : 'Invalid invite link')
      return
    }

    setLoading(true)
    try {
      const result = await joinGroupViaToken(token)
      const toast = (await import('react-hot-toast')).default

      switch (result.status) {
        case 'joined':
          toast.success(locale === 'zh' ? '已加入群聊' : 'Joined group')
          setInputValue('')
          onClose()
          break
        case 'pending':
          toast(locale === 'zh' ? '申请已提交，等待审批' : 'Request submitted, pending approval', {
            icon: '\u2139\uFE0F',
          })
          setInputValue('')
          onClose()
          break
        case 'expired':
          toast.error(locale === 'zh' ? '链接已过期' : 'Link expired')
          break
        case 'invalid':
          toast.error(locale === 'zh' ? '无效的邀请链接' : 'Invalid invite link')
          break
        case 'disabled':
          toast.error(locale === 'zh' ? '该群已关闭此入群方式' : 'This join method is disabled')
          break
        case 'full':
          toast.error(locale === 'zh' ? '群成员已满' : 'Group is full')
          break
        case 'already_member':
          toast(locale === 'zh' ? '你已是群成员' : 'You are already a member', {
            icon: '\u2139\uFE0F',
          })
          setInputValue('')
          onClose()
          break
        default:
          toast.error(locale === 'zh' ? '加入失败' : 'Failed to join')
      }
    } catch {
      const toast = (await import('react-hot-toast')).default
      toast.error(locale === 'zh' ? '加入失败' : 'Failed to join')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent>
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle>{locale === 'zh' ? '加入群聊' : 'Join Group'}</DrawerTitle>
          <DrawerDescription>
            {locale === 'zh' ? '输入邀请码或链接加入群聊' : 'Enter an invite code or link to join a group'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 space-y-4">
          {/* Input field with paste button */}
          <div className="relative">
            <input
              ref={inputCallbackRef}
              type="text"
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder={locale === 'zh' ? '输入邀请码或链接' : 'Enter invite code or link'}
              className="w-full bg-muted rounded-xl px-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
              disabled={loading}
            />
            {!input && (
              <button
                onClick={handlePaste}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                title={locale === 'zh' ? '粘贴' : 'Paste'}
                type="button"
              >
                <ClipboardPaste className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Invite preview card */}
          {invitePreview && (
            <div className="p-3 bg-muted/50 rounded-xl border border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[var(--ogbo-blue)]/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[var(--ogbo-blue)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{invitePreview.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitePreview.memberCount} {locale === 'zh' ? '成员' : 'members'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Loading preview spinner */}
          {loadingPreview && (
            <div className="flex justify-center py-3">
              <div className="w-5 h-5 border-2 border-[var(--ogbo-blue)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Invalid link message */}
          {inviteLinkInvalid && !loadingPreview && (
            <div className="p-3 bg-muted/50 rounded-xl border border-border text-center">
              <p className="text-sm text-muted-foreground">
                {locale === 'zh' ? '邀请链接无效或已过期' : 'Invite link is invalid or expired'}
              </p>
            </div>
          )}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={loading || !input.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-40 transition-all"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4" />
            )}
            {loading
              ? (locale === 'zh' ? '加入中...' : 'Joining...')
              : (locale === 'zh' ? '加入' : 'Join')
            }
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
