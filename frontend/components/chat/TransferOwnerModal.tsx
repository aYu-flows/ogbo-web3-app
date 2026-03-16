'use client'

import { useState } from 'react'
import { Loader2, Crown } from 'lucide-react'
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { transferOwnership, fetchGroupDetail } from '@/lib/group-management'
import UserAvatar from '@/components/UserAvatar'

interface TransferOwnerModalProps {
  open: boolean
  onClose: () => void
  groupId: string
  members: string[]
  currentOwner: string
}

export default function TransferOwnerModal({
  open,
  onClose,
  groupId,
  members,
  currentOwner,
}: TransferOwnerModalProps) {
  const locale = useStore((s) => s.locale)
  const getDisplayName = useStore((s) => s.getDisplayName)

  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [transferring, setTransferring] = useState(false)

  // Exclude current owner from the member list
  const eligibleMembers = members.filter(
    (m) => m.toLowerCase() !== currentOwner.toLowerCase()
  )

  const handleMemberTap = (wallet: string) => {
    if (transferring) return
    setSelectedWallet(wallet)
    setConfirmOpen(true)
  }

  const handleConfirmTransfer = async () => {
    if (!selectedWallet || transferring) return
    setTransferring(true)
    try {
      // Fetch latest group detail for current admins
      const group = await fetchGroupDetail(groupId)
      await transferOwnership(groupId, selectedWallet, group.admins)
      hotToast.success(t('group.transferSuccess', locale))
      setConfirmOpen(false)
      setSelectedWallet(null)
      onClose()
    } catch {
      hotToast.error(t('group.error.operationFailed', locale))
    } finally {
      setTransferring(false)
    }
  }

  const handleCancelConfirm = () => {
    if (transferring) return
    setConfirmOpen(false)
    setSelectedWallet(null)
  }

  const handleDrawerClose = () => {
    if (transferring) return
    setConfirmOpen(false)
    setSelectedWallet(null)
    onClose()
  }

  const selectedName = selectedWallet ? getDisplayName(selectedWallet) : ''
  const confirmMessage = t('group.transferConfirm', locale).replace('{name}', selectedName)

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => !v && handleDrawerClose()}>
        <DrawerContent className="bg-card border-border">
          <DrawerHeader className="text-left">
            <DrawerTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              {t('group.transferOwnership', locale)}
            </DrawerTitle>
            <DrawerDescription className="text-xs text-muted-foreground">
              {locale === 'zh'
                ? '选择一位成员成为新群主'
                : 'Select a member to become the new owner'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
            {eligibleMembers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <p className="text-sm text-muted-foreground">
                  {locale === 'zh' ? '暂无可转让的成员' : 'No eligible members'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {eligibleMembers.map((wallet) => {
                  const displayName = getDisplayName(wallet)
                  return (
                    <button
                      key={wallet}
                      onClick={() => handleMemberTap(wallet)}
                      disabled={transferring}
                      className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                    >
                      <UserAvatar address={wallet} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate font-mono">
                          {wallet.slice(0, 6)}...{wallet.slice(-4)}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Confirmation AlertDialog */}
      <AlertDialog open={confirmOpen} onOpenChange={(v) => !v && handleCancelConfirm()}>
        <AlertDialogContent className="max-w-sm mx-4 bg-card border-border rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              {t('group.transferOwnership', locale)}
            </AlertDialogTitle>
            <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transferring} onClick={handleCancelConfirm}>
              {t('common.cancel', locale)}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTransfer}
              disabled={transferring}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {transferring ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.loading', locale)}
                </span>
              ) : (
                t('common.confirm', locale)
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
