'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from 'lucide-react'

type JoinStatus =
  | 'loading'
  | 'joined'
  | 'pending'
  | 'expired'
  | 'invalid'
  | 'disabled'
  | 'full'
  | 'already_member'
  | 'error'
  | 'no_token'

export default function GroupJoinPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { isLoggedIn, joinGroupViaToken, locale } = useStore()
  const [status, setStatus] = useState<JoinStatus>('loading')
  const [groupId, setGroupId] = useState<string | null>(null)

  const token = searchParams.get('token')

  useEffect(() => {
    if (!token) {
      setStatus('no_token')
      return
    }

    if (!isLoggedIn) {
      const returnUrl = `/group/join?token=${encodeURIComponent(token)}`
      router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
      return
    }

    let cancelled = false

    const doJoin = async () => {
      setStatus('loading')
      try {
        const result = await joinGroupViaToken(token)
        if (cancelled) return
        setGroupId(result.groupId || null)
        setStatus(result.status as JoinStatus)
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    doJoin()

    return () => { cancelled = true }
  }, [token, isLoggedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBackToChat = () => {
    if (status === 'joined' && groupId) {
      router.replace(`/?tab=chat&chatId=${groupId}`)
    } else {
      router.replace('/?tab=chat')
    }
  }

  const renderContent = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-[var(--ogbo-blue)]" />
            <p className="text-base text-muted-foreground">
              {locale === 'zh' ? '正在加入群聊...' : 'Joining group...'}
            </p>
          </div>
        )

      case 'joined':
        return (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '已加入群聊' : 'Joined Group'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '你已成功加入群聊' : 'You have successfully joined the group'}
              </p>
            </div>
          </div>
        )

      case 'pending':
        return (
          <div className="flex flex-col items-center gap-4">
            <Clock className="w-12 h-12 text-amber-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '申请已提交' : 'Request Submitted'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '等待群管理员审批' : 'Waiting for admin approval'}
              </p>
            </div>
          </div>
        )

      case 'already_member':
        return (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="w-12 h-12 text-blue-400" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '你已是群成员' : 'Already a Member'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '你已经在这个群聊中了' : 'You are already in this group'}
              </p>
            </div>
          </div>
        )

      case 'expired':
        return (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-[var(--ogbo-red)]" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '链接已过期' : 'Link Expired'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '该邀请链接已失效' : 'This invite link has expired'}
              </p>
            </div>
          </div>
        )

      case 'invalid':
      case 'no_token':
        return (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-[var(--ogbo-red)]" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '无效的邀请链接' : 'Invalid Invite Link'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '请检查链接是否正确' : 'Please check if the link is correct'}
              </p>
            </div>
          </div>
        )

      case 'disabled':
        return (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-[var(--ogbo-red)]" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '入群方式已关闭' : 'Join Method Disabled'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '该群已关闭此入群方式' : 'This group has disabled this join method'}
              </p>
            </div>
          </div>
        )

      case 'full':
        return (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-[var(--ogbo-red)]" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '群成员已满' : 'Group is Full'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '该群已达到成员上限' : 'This group has reached its member limit'}
              </p>
            </div>
          </div>
        )

      case 'error':
      default:
        return (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="w-12 h-12 text-[var(--ogbo-red)]" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {locale === 'zh' ? '加入失败' : 'Failed to Join'}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {locale === 'zh' ? '请稍后重试' : 'Please try again later'}
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-card rounded-2xl shadow-xl p-8 space-y-6">
        {renderContent()}

        {status !== 'loading' && (
          <button
            onClick={handleBackToChat}
            className="w-full flex items-center justify-center gap-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl px-4 py-3 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {locale === 'zh' ? '返回聊天' : 'Back to Chat'}
          </button>
        )}
      </div>
    </div>
  )
}
