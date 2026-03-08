import { supabase } from '@/lib/supabaseClient'

// ======== Types ========

export interface ProfileRow {
  wallet_address: string
  nickname: string | null
  avatar_url: string | null
  friend_permission: string
  updated_at: string
}

export type FriendPermission = 'allow_all' | 'approve_required' | 'reject_all'
export const FRIEND_PERMISSION_DEFAULT: FriendPermission = 'approve_required'

/** Parse raw DB value to type-safe FriendPermission, fallback to default for null/invalid */
export function parseFriendPermission(raw: string | null | undefined): FriendPermission {
  if (raw === 'allow_all' || raw === 'approve_required' || raw === 'reject_all') return raw
  return FRIEND_PERMISSION_DEFAULT
}

export interface ProfileData {
  nickname: string | null
  avatarUrl: string | null
  friendPermission: FriendPermission
}

// ======== Constants ========

const AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const NICKNAME_MAX_LENGTH = 20

// ======== CRUD ========

export async function fetchProfile(walletAddress: string): Promise<ProfileData | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('nickname, avatar_url, friend_permission')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    nickname: data.nickname,
    avatarUrl: data.avatar_url,
    friendPermission: parseFriendPermission(data.friend_permission),
  }
}

export async function fetchProfiles(
  walletAddresses: string[]
): Promise<Record<string, ProfileData>> {
  if (walletAddresses.length === 0) return {}
  const addresses = walletAddresses.map(a => a.toLowerCase())
  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_address, nickname, avatar_url, friend_permission')
    .in('wallet_address', addresses)
  if (error) throw error

  const result: Record<string, ProfileData> = {}
  for (const row of (data || []) as ProfileRow[]) {
    result[row.wallet_address] = {
      nickname: row.nickname,
      avatarUrl: row.avatar_url,
      friendPermission: parseFriendPermission(row.friend_permission),
    }
  }
  return result
}

export async function upsertProfile(params: {
  wallet_address: string
  nickname?: string | null
  avatar_url?: string | null
  friend_permission?: FriendPermission
}): Promise<void> {
  const record: Record<string, unknown> = {
    wallet_address: params.wallet_address.toLowerCase(),
    updated_at: new Date().toISOString(),
  }
  if (params.nickname !== undefined) {
    const nick = params.nickname
    if (nick && nick.length > NICKNAME_MAX_LENGTH) {
      throw new Error(`Nickname exceeds max length of ${NICKNAME_MAX_LENGTH}`)
    }
    record.nickname = nick
  }
  if (params.avatar_url !== undefined) {
    record.avatar_url = params.avatar_url
  }
  if (params.friend_permission !== undefined) {
    record.friend_permission = params.friend_permission
  }

  const { error } = await supabase
    .from('profiles')
    .upsert(record, { onConflict: 'wallet_address' })
  if (error) throw error
}

/** Fetch a single user's friend permission setting */
export async function fetchFriendPermission(walletAddress: string): Promise<FriendPermission> {
  const { data, error } = await supabase
    .from('profiles')
    .select('friend_permission')
    .eq('wallet_address', walletAddress.toLowerCase())
    .maybeSingle()
  if (error) throw error
  return parseFriendPermission(data?.friend_permission)
}

// ======== Avatar Storage ========

export function validateAvatarFile(file: File): string | null {
  if (file.size > AVATAR_MAX_SIZE) return 'avatarTooLarge'
  if (!AVATAR_ALLOWED_TYPES.includes(file.type)) return 'avatarFormatError'
  return null
}

export async function uploadAvatar(
  walletAddress: string,
  file: File
): Promise<string> {
  const validationError = validateAvatarFile(file)
  if (validationError) throw new Error(validationError)

  const addr = walletAddress.toLowerCase()
  const ext = file.name.split('.').pop() || 'jpg'
  const filePath = `${addr}/${Date.now()}.${ext}`

  // Delete old avatars for this user
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(addr)
  if (existingFiles && existingFiles.length > 0) {
    const pathsToDelete = existingFiles.map(f => `${addr}/${f.name}`)
    await supabase.storage.from('avatars').remove(pathsToDelete)
  }

  // Upload new avatar
  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { contentType: file.type, upsert: true })
  if (error) throw error

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath)

  return urlData.publicUrl
}

export async function deleteAvatar(
  walletAddress: string,
  filePath: string
): Promise<void> {
  const { error } = await supabase.storage
    .from('avatars')
    .remove([filePath])
  if (error) throw error
}
