'use client'

import { useState, useEffect, useCallback } from 'react'
import { Check, X, Loader2, Clock, Link2, UserPlus } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import UserAvatar from '@/components/UserAvatar'
import type { GroupJoinRequestRow } from '@/lib/group-management'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

interface GroupJoinRequestListProps {
  open: boolean
  onClose: () => void
  groupId: string
}

export default function GroupJoinRequestList({ open, onClose, groupId }: GroupJoinRequestListProps) {
  const { fetchGroupJoinRequests, handleJoinRequestAction, getDisplayName, locale } = useStore()
  const [requests, setRequests] = useState<GroupJoinRequestRow[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<number, 'approve' | 'reject' | null>>({})

  const loadRequests = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchGroupJoinRequests(groupId)
      setRequests(data)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }, [groupId, fetchGroupJoinRequests])

  useEffect(() => {
    if (open) {
      loadRequests()
    }
  }, [open, groupId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = async (requestId: number, action: 'approved' | 'rejected') => {
    const loadingKey = action === 'approved' ? 'approve' : 'reject'
    setActionLoading((prev) => ({ ...prev, [requestId]: loadingKey }))
    try {
      await handleJoinRequestAction(requestId, action, groupId)
      setRequests((prev) => prev.filter((r) => r.id !== requestId))
      const toast = (await import('react-hot-toast')).default
      if (action === 'approved') {
        toast.success(locale === 'zh' ? '已批准' : 'Approved')
      } else {
        toast.success(locale === 'zh' ? '已拒绝' : 'Rejected')
      }
    } catch {
      const toast = (await import('react-hot-toast')).default
      toast.error(locale === 'zh' ? '操作失败' : 'Action failed')
    } finally {
      setActionLoading((prev) => ({ ...prev, [requestId]: null }))
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    const diffHour = Math.floor(diffMs / 3600000)
    const diffDay = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return locale === 'zh' ? '刚刚' : 'Just now'
    if (diffMin < 60) return locale === 'zh' ? `${diffMin} 分钟前` : `${diffMin}m ago`
    if (diffHour < 24) return locale === 'zh' ? `${diffHour} 小时前` : `${diffHour}h ago`
    if (diffDay < 30) return locale === 'zh' ? `${diffDay} 天前` : `${diffDay}d ago`
    return date.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <DrawerTitle>{locale === 'zh' ? '入群审批' : 'Join Requests'}</DrawerTitle>
          <DrawerDescription>
            {locale === 'zh' ? '审批待处理的入群请求' : 'Review pending join requests'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="p-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <UserPlus className="w-10 h-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {locale === 'zh' ? '暂无待审批请求' : 'No pending requests'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => {
                const isApproving = actionLoading[req.id] === 'approve'
                const isRejecting = actionLoading[req.id] === 'reject'
                const isProcessing = isApproving || isRejecting

                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 bg-muted/50 rounded-xl px-3 py-3"
                  >
                    {/* Avatar */}
                    <UserAvatar address={req.requester} size="sm" />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getDisplayName(req.requester)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {/* Request type badge */}
                        <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${
                          req.request_type === 'link'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {req.request_type === 'link' ? (
                            <>
                              <Link2 className="w-3 h-3" />
                              {locale === 'zh' ? '链接' : 'via link'}
                            </>
                          ) : (
                            <>
                              <UserPlus className="w-3 h-3" />
                              {req.invited_by
                                ? (locale === 'zh'
                                    ? `${getDisplayName(req.invited_by).slice(0, 8)} 邀请`
                                    : `by ${getDisplayName(req.invited_by).slice(0, 8)}`)
                                : (locale === 'zh' ? '邀请' : 'invited')
                              }
                            </>
                          )}
                        </span>
                        {/* Time */}
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatTime(req.created_at)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleAction(req.id, 'approved')}
                        disabled={isProcessing}
                        className="rounded-lg p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                        title={locale === 'zh' ? '批准' : 'Approve'}
                      >
                        {isApproving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleAction(req.id, 'rejected')}
                        disabled={isProcessing}
                        className="rounded-lg p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                        title={locale === 'zh' ? '拒绝' : 'Reject'}
                      >
                        {isRejecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
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
