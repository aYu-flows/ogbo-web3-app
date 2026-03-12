'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer'
import type { MuteDuration } from '@/lib/group-management'

interface MuteMemberModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  targetWallet: string
  targetName: string
}

interface DurationOption {
  label: string
  labelEn: string
  value: MuteDuration
  i18nKey: string
}

const DURATION_OPTIONS: DurationOption[] = [
  { label: '10分钟', labelEn: '10 minutes', value: 10, i18nKey: 'group.muteDuration.10m' },
  { label: '1小时', labelEn: '1 hour', value: 60, i18nKey: 'group.muteDuration.1h' },
  { label: '12小时', labelEn: '12 hours', value: 720, i18nKey: 'group.muteDuration.12h' },
  { label: '1天', labelEn: '1 day', value: 1440, i18nKey: 'group.muteDuration.1d' },
  { label: '永久', labelEn: 'Forever', value: null, i18nKey: 'group.muteDuration.forever' },
]

export default function MuteMemberModal({
  open,
  onClose,
  groupId,
  targetWallet,
  targetName,
}: MuteMemberModalProps) {
  const { locale, muteMember } = useStore()
  const [selected, setSelected] = useState<MuteDuration>(10)
  const [loading, setLoading] = useState(false)

  // Track whether "forever" (null) is selected vs a numeric value
  const [isForever, setIsForever] = useState(false)

  const handleSelect = (opt: DurationOption) => {
    setSelected(opt.value)
    setIsForever(opt.value === null)
  }

  const handleConfirm = async () => {
    if (loading) return
    setLoading(true)
    try {
      const duration = isForever ? null : selected
      await muteMember(groupId, targetWallet, duration)
      onClose()
    } catch {
      // error handled inside store
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setSelected(10)
    setIsForever(false)
    onClose()
  }

  const title = `${t('group.muteMember', locale)} ${targetName}`

  return (
    <Drawer open={open} onOpenChange={(o) => !o && handleClose()}>
      <DrawerContent className="z-[70]">
        <DrawerHeader className="border-b border-border">
          <DrawerTitle className="truncate">{title}</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 py-4 space-y-2">
          {DURATION_OPTIONS.map((opt) => {
            const isSelected = isForever
              ? opt.value === null
              : opt.value === selected && opt.value !== null

            return (
              <button
                key={opt.i18nKey}
                onClick={() => handleSelect(opt)}
                disabled={loading}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors text-left ${
                  isSelected
                    ? 'bg-[var(--ogbo-blue)]/10 ring-1 ring-[var(--ogbo-blue)]/40'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {/* Radio circle */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[var(--ogbo-blue)] bg-[var(--ogbo-blue)]'
                      : 'border-border'
                  }`}
                >
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                  )}
                </div>

                <span>{t(opt.i18nKey, locale)}</span>
              </button>
            )
          })}
        </div>

        <DrawerFooter>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[var(--ogbo-blue)] text-white rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[var(--ogbo-blue-hover)] disabled:opacity-50 transition-all"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {locale === 'zh' ? '确认禁言' : 'Confirm Mute'}
          </button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
