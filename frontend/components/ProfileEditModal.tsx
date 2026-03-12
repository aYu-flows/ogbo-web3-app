'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Camera, Check } from 'lucide-react'
import { useStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { validateAvatarFile } from '@/lib/profile'
import type { FriendPermission } from '@/lib/profile'
import { useIMEComposition } from '@/hooks/use-ime-composition'
import UserAvatar from '@/components/UserAvatar'
import WalletAddress from '@/components/chat/WalletAddress'
import toast from 'react-hot-toast'

const PERMISSION_OPTIONS: { value: FriendPermission; labelKey: string }[] = [
  { value: 'anyone', labelKey: 'profile.allowAll' },
  { value: 'confirm', labelKey: 'profile.approveRequired' },
  { value: 'reject', labelKey: 'profile.rejectAll' },
]

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const { walletAddress, myProfile, locale, updateNickname, updateAvatar, updateFriendPermission } = useStore()
  const [nickname, setNickname] = useState(myProfile?.nickname || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingPermission, setSavingPermission] = useState<FriendPermission | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nicknameInputRef = useRef<HTMLInputElement>(null)
  const { onCompositionStart, onCompositionEnd } = useIMEComposition()

  // Sync nickname when modal opens
  const [lastOpen, setLastOpen] = useState(false)
  if (isOpen && !lastOpen) {
    setNickname(myProfile?.nickname || '')
    setSaved(false)
    setLastOpen(true)
  } else if (!isOpen && lastOpen) {
    setLastOpen(false)
  }

  if (!walletAddress) return null

  const handleSaveNickname = async () => {
    const trimmed = (nicknameInputRef.current?.value ?? nickname).trim()
    // No change — skip silently
    if (trimmed === (myProfile?.nickname || '')) return
    if (trimmed.length > 20) {
      toast.error(t('profile.nicknameTooLong', locale))
      return
    }
    setSaving(true)
    try {
      await updateNickname(trimmed)
      setSaved(true)
      toast.success(t('profile.saved', locale))
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error(t('profile.saveFailed', locale))
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validationError = validateAvatarFile(file)
    if (validationError) {
      toast.error(t(`profile.${validationError}`, locale))
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadingAvatar(true)
    try {
      await updateAvatar(file)
      toast.success(t('profile.saved', locale))
    } catch {
      toast.error(t('profile.uploadFailed', locale))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePermissionChange = async (permission: FriendPermission) => {
    if (permission === currentPermission || savingPermission) return
    setSavingPermission(permission)
    try {
      await updateFriendPermission(permission)
      toast.success(t('profile.permissionSaved', locale))
    } catch {
      toast.error(t('profile.saveFailed', locale))
    } finally {
      setSavingPermission(null)
    }
  }

  const currentPermission = myProfile?.friendPermission ?? 'confirm'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ type: 'spring', damping: 28, stiffness: 350 }}
            className="relative w-full max-w-sm rounded-2xl bg-card border border-border shadow-xl overflow-hidden max-h-[85vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">{t('profile.title', locale)}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1 hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Avatar section */}
            <div className="flex flex-col items-center pt-6 pb-4">
              <button
                onClick={handleAvatarClick}
                disabled={uploadingAvatar}
                className="relative group"
              >
                <UserAvatar address={walletAddress} size="lg" className="!w-20 !h-20 !text-2xl" />
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingAvatar ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </div>
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {t('profile.changeAvatar', locale)}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Nickname section */}
            <div className="px-5 pb-4">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('profile.nickname', locale)}
              </label>
              <div className="relative">
                <input
                  ref={nicknameInputRef}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onCompositionStart={onCompositionStart}
                  onCompositionEnd={(e) => { onCompositionEnd(); setNickname(e.currentTarget.value) }}
                  maxLength={20}
                  placeholder={t('profile.nicknamePlaceholder', locale)}
                  className="w-full rounded-xl bg-muted px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ogbo-blue)]/20 transition-all pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  {nickname.length}/20
                </span>
              </div>
              <button
                onClick={handleSaveNickname}
                disabled={saving}
                className="mt-3 w-full rounded-xl bg-[var(--ogbo-blue)] py-2.5 text-sm font-medium text-white hover:bg-[var(--ogbo-blue-hover)] transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {saving ? (
                  t('profile.saving', locale)
                ) : saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    {t('profile.saved', locale)}
                  </>
                ) : (
                  t('profile.save', locale)
                )}
              </button>
            </div>

            {/* Privacy settings section */}
            <div className="px-5 pb-4 border-t border-border pt-4">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('profile.privacySettings', locale)}
              </label>
              <div className="rounded-xl bg-muted overflow-hidden">
                {PERMISSION_OPTIONS.map((opt) => {
                  const isSelected = currentPermission === opt.value
                  const isSaving = savingPermission === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handlePermissionChange(opt.value)}
                      disabled={!!savingPermission}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left hover:bg-muted-foreground/5 transition-colors disabled:opacity-60"
                    >
                      {/* Radio circle */}
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        isSelected ? 'border-[var(--ogbo-blue)]' : 'border-border'
                      }`}>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-[var(--ogbo-blue)]" />
                        )}
                      </div>
                      <span className={isSelected ? 'text-foreground' : 'text-muted-foreground'}>
                        {t(opt.labelKey, locale)}
                      </span>
                      {isSaving && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-3.5 h-3.5 border-2 border-muted-foreground/30 border-t-[var(--ogbo-blue)] rounded-full ml-auto flex-shrink-0"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Wallet address section */}
            <div className="px-5 pb-5 border-t border-border pt-4">
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                {t('profile.walletAddress', locale)}
              </label>
              <WalletAddress address={walletAddress} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
