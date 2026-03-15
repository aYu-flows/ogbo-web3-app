'use client'

import { useState } from 'react'
import { Loader2, LogIn, ClipboardPaste } from 'lucide-react'
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

  const handleClose = () => {
    if (loading) return
    setInput('')
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
            setInput(value.trim())
            return
          }
        }
      } catch {
        // Capacitor unavailable
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text.trim()) setInput(text.trim())
      }
    } catch {
      // silently fail
    }
  }

  const handleJoin = async () => {
    if (loading || !input.trim()) return
    const token = parseInviteToken(input.trim())
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
          setInput('')
          onClose()
          break
        case 'pending':
          toast(locale === 'zh' ? '申请已提交，等待审批' : 'Request submitted, pending approval', {
            icon: '\u2139\uFE0F',
          })
          setInput('')
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
          setInput('')
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
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }, 300)
              }}
              placeholder={locale === 'zh' ? '输入邀请码或链接' : 'Enter invite code or link'}
              className="w-full bg-muted rounded-xl px-4 pr-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/30"
              disabled={loading}
              autoFocus
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
