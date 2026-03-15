import { supabase } from '@/lib/supabaseClient'

// ─── Types ───────────────────────────────────────────────────────────

export type GroupRole = 'owner' | 'admin' | 'member'
export type JoinMode = 'free' | 'approval' | 'disabled'
export type MuteDuration = 10 | 60 | 720 | 1440 | null // minutes, null=forever

export interface GroupDetail {
  id: string
  name: string
  creator: string
  members: string[]
  admins: string[]
  announcement: string | null
  announcement_at: string | null
  announcement_by: string | null
  join_mode: JoinMode
  invite_approval: boolean
  mute_all: boolean
  avatar_url: string | null
  created_at: string
}

export interface GroupMemberRow {
  group_id: string
  wallet_address: string
  group_nickname: string | null
  pinned: boolean
  muted_notifications: boolean
  joined_at: string
  last_read_announcement_at: string | null
}

export interface GroupMuteRow {
  id: number
  group_id: string
  wallet_address: string
  muted_by: string
  mute_until: string | null
  created_at: string
}

export interface GroupInviteRow {
  id: string
  group_id: string
  token: string
  created_by: string
  expires_at: string | null
  created_at: string
}

export interface GroupJoinRequestRow {
  id: number
  group_id: string
  requester: string
  invited_by: string | null
  request_type: 'link' | 'invite'
  status: 'pending' | 'approved' | 'rejected'
  handled_by: string | null
  created_at: string
  handled_at: string | null
}

// ─── Error Classes ───────────────────────────────────────────────────

export class MutedError extends Error {
  constructor(public muteUntil: string | null) {
    super('User is muted')
    this.name = 'MutedError'
  }
}

export class GroupFullError extends Error {
  constructor() {
    super('Group member limit reached (200)')
    this.name = 'GroupFullError'
  }
}

export class AdminLimitError extends Error {
  constructor() {
    super('Admin limit reached (10)')
    this.name = 'AdminLimitError'
  }
}

// ─── Functions ───────────────────────────────────────────────────────

/** 1. Pure function: determine a wallet's role in a group */
export function getGroupRole(group: GroupDetail, wallet: string): GroupRole {
  const w = wallet.toLowerCase()
  if (group.creator.toLowerCase() === w) return 'owner'
  if (group.admins.some((a) => a.toLowerCase() === w)) return 'admin'
  return 'member'
}

/** 2. Fetch full group detail by ID */
export async function fetchGroupDetail(groupId: string): Promise<GroupDetail> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (error) throw new Error(`fetchGroupDetail: ${error.message}`)
  return data as GroupDetail
}

/** 3. Fetch all members of a group */
export async function fetchGroupMembers(groupId: string): Promise<GroupMemberRow[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)

  if (error) throw new Error(`fetchGroupMembers: ${error.message}`)
  return (data ?? []) as GroupMemberRow[]
}

/** 4. Fetch my personal settings for a group */
export async function fetchMyGroupSettings(
  groupId: string,
  wallet: string,
): Promise<GroupMemberRow | null> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('wallet_address', wallet.toLowerCase())
    .maybeSingle()

  if (error) throw new Error(`fetchMyGroupSettings: ${error.message}`)
  return data as GroupMemberRow | null
}

/** 5. Update group name (non-empty, trimmed, <=50 chars) */
export async function updateGroupName(groupId: string, newName: string): Promise<void> {
  const trimmed = newName.trim()
  if (!trimmed) throw new Error('Group name cannot be empty')
  if (trimmed.length > 50) throw new Error('Group name too long')

  const { error } = await supabase
    .from('groups')
    .update({ name: trimmed })
    .eq('id', groupId)

  if (error) throw new Error(`updateGroupName: ${error.message}`)
}

/** 6. Update group settings (join_mode, invite_approval, mute_all) */
export async function updateGroupSettings(
  groupId: string,
  settings: Partial<{ join_mode: JoinMode; invite_approval: boolean; mute_all: boolean }>,
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update(settings)
    .eq('id', groupId)

  if (error) throw new Error(`updateGroupSettings: ${error.message}`)
}

/** 7. Set group announcement */
export async function setGroupAnnouncement(
  groupId: string,
  text: string,
  byWallet: string,
): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({
      announcement: text,
      announcement_at: new Date().toISOString(),
      announcement_by: byWallet.toLowerCase(),
    })
    .eq('id', groupId)

  if (error) throw new Error(`setGroupAnnouncement: ${error.message}`)
}

/** 8. Add an admin (max 10) */
export async function addAdmin(groupId: string, wallet: string): Promise<void> {
  const group = await fetchGroupDetail(groupId)

  if (group.admins.length >= 10) throw new AdminLimitError()

  const w = wallet.toLowerCase()
  if (group.admins.includes(w)) return // already an admin

  const { error } = await supabase
    .from('groups')
    .update({ admins: [...group.admins, w] })
    .eq('id', groupId)

  if (error) throw new Error(`addAdmin: ${error.message}`)
}

/** 9. Remove an admin */
export async function removeAdmin(groupId: string, wallet: string): Promise<void> {
  const group = await fetchGroupDetail(groupId)
  const w = wallet.toLowerCase()
  const updated = group.admins.filter((a) => a.toLowerCase() !== w)

  const { error } = await supabase
    .from('groups')
    .update({ admins: updated })
    .eq('id', groupId)

  if (error) throw new Error(`removeAdmin: ${error.message}`)
}

/** 10. Transfer group ownership */
export async function transferOwnership(
  groupId: string,
  newOwner: string,
  currentAdmins: string[],
): Promise<void> {
  const owner = newOwner.toLowerCase()
  const updatedAdmins = currentAdmins.filter((a) => a.toLowerCase() !== owner)

  const { error } = await supabase
    .from('groups')
    .update({ creator: owner, admins: updatedAdmins })
    .eq('id', groupId)

  if (error) throw new Error(`transferOwnership: ${error.message}`)
}

/** 11. Add members to a group (max 200 total) */
export async function addGroupMembers(groupId: string, wallets: string[]): Promise<void> {
  const group = await fetchGroupDetail(groupId)
  const normalized = wallets.map((w) => w.toLowerCase())

  // Deduplicate against existing members
  const newWallets = normalized.filter((w) => !group.members.includes(w))
  if (newWallets.length === 0) return

  if (group.members.length + newWallets.length > 200) throw new GroupFullError()

  // Update members array on groups table
  const { error: updateError } = await supabase
    .from('groups')
    .update({ members: [...group.members, ...newWallets] })
    .eq('id', groupId)

  if (updateError) throw new Error(`addGroupMembers (update): ${updateError.message}`)

  // Insert group_members rows
  const rows = newWallets.map((w) => ({
    group_id: groupId,
    wallet_address: w,
  }))

  const { error: insertError } = await supabase.from('group_members').insert(rows)

  if (insertError) throw new Error(`addGroupMembers (insert): ${insertError.message}`)
}

/** 12. Remove a member from a group */
export async function removeGroupMember(groupId: string, wallet: string): Promise<void> {
  const group = await fetchGroupDetail(groupId)
  const w = wallet.toLowerCase()

  // Remove from members array
  const updatedMembers = group.members.filter((m) => m.toLowerCase() !== w)
  // Remove from admins if present
  const updatedAdmins = group.admins.filter((a) => a.toLowerCase() !== w)

  const { error: updateError } = await supabase
    .from('groups')
    .update({ members: updatedMembers, admins: updatedAdmins })
    .eq('id', groupId)

  if (updateError) throw new Error(`removeGroupMember (update): ${updateError.message}`)

  // Delete group_members row
  const { error: memberError } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('wallet_address', w)

  if (memberError) throw new Error(`removeGroupMember (member): ${memberError.message}`)

  // Delete group_mutes row if any
  const { error: muteError } = await supabase
    .from('group_mutes')
    .delete()
    .eq('group_id', groupId)
    .eq('wallet_address', w)

  if (muteError) throw new Error(`removeGroupMember (mute): ${muteError.message}`)
}

/** 13. Leave a group (same as removeGroupMember) */
export async function leaveGroup(groupId: string, wallet: string): Promise<void> {
  return removeGroupMember(groupId, wallet)
}

/** 14. Dissolve a group (CASCADE deletes related rows) */
export async function dissolveGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (error) throw new Error(`dissolveGroup: ${error.message}`)
}

/** 15. Mute a group member (upsert) */
export async function muteGroupMember(
  groupId: string,
  wallet: string,
  duration: MuteDuration,
  mutedBy: string,
): Promise<void> {
  const muteUntil =
    duration !== null
      ? new Date(Date.now() + duration * 60000).toISOString()
      : null

  const { error } = await supabase
    .from('group_mutes')
    .upsert(
      {
        group_id: groupId,
        wallet_address: wallet.toLowerCase(),
        muted_by: mutedBy.toLowerCase(),
        mute_until: muteUntil,
      },
      { onConflict: 'group_id,wallet_address' },
    )

  if (error) throw new Error(`muteGroupMember: ${error.message}`)
}

/** 16. Unmute a group member */
export async function unmuteGroupMember(groupId: string, wallet: string): Promise<void> {
  const { error } = await supabase
    .from('group_mutes')
    .delete()
    .eq('group_id', groupId)
    .eq('wallet_address', wallet.toLowerCase())

  if (error) throw new Error(`unmuteGroupMember: ${error.message}`)
}

/** 17. Fetch mute status for a member */
export async function fetchMuteStatus(
  groupId: string,
  wallet: string,
): Promise<GroupMuteRow | null> {
  const { data, error } = await supabase
    .from('group_mutes')
    .select('*')
    .eq('group_id', groupId)
    .eq('wallet_address', wallet.toLowerCase())
    .maybeSingle()

  if (error) throw new Error(`fetchMuteStatus: ${error.message}`)
  return data as GroupMuteRow | null
}

/** 18. Create an invite link */
export async function createInviteLink(
  groupId: string,
  createdBy: string,
  expiresInDays: number | null,
): Promise<GroupInviteRow> {
  const token = crypto.randomUUID()
  const expiresAt =
    expiresInDays !== null
      ? new Date(Date.now() + expiresInDays * 86400000).toISOString()
      : null

  const { data, error } = await supabase
    .from('group_invites')
    .insert({
      group_id: groupId,
      token,
      created_by: createdBy.toLowerCase(),
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) throw new Error(`createInviteLink: ${error.message}`)
  return data as GroupInviteRow
}

/** 19. Fetch all invite links for a group */
export async function fetchInviteLinks(groupId: string): Promise<GroupInviteRow[]> {
  const { data, error } = await supabase
    .from('group_invites')
    .select('*')
    .eq('group_id', groupId)

  if (error) throw new Error(`fetchInviteLinks: ${error.message}`)
  return (data ?? []) as GroupInviteRow[]
}

/** 20. Revoke an invite link */
export async function revokeInviteLink(inviteId: string): Promise<void> {
  const { error } = await supabase
    .from('group_invites')
    .delete()
    .eq('id', inviteId)

  if (error) throw new Error(`revokeInviteLink: ${error.message}`)
}

/** 21. Join a group via invite token */
export async function joinViaInviteToken(
  token: string,
  wallet: string,
): Promise<{
  groupId: string
  status: 'joined' | 'pending' | 'expired' | 'invalid' | 'disabled' | 'full' | 'already_member'
}> {
  const w = wallet.toLowerCase()

  // Find invite by token
  const { data: invite, error: inviteError } = await supabase
    .from('group_invites')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (inviteError) throw new Error(`joinViaInviteToken: ${inviteError.message}`)
  if (!invite) return { groupId: '', status: 'invalid' }

  const inv = invite as GroupInviteRow

  // Check expiry
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) {
    return { groupId: inv.group_id, status: 'expired' }
  }

  // Fetch group
  let group: GroupDetail
  try {
    group = await fetchGroupDetail(inv.group_id)
  } catch {
    return { groupId: inv.group_id, status: 'invalid' }
  }

  // Check already member
  if (group.members.includes(w)) {
    return { groupId: group.id, status: 'already_member' }
  }

  // Check full
  if (group.members.length >= 200) {
    return { groupId: group.id, status: 'full' }
  }

  // Check join_mode
  if (group.join_mode === 'disabled') {
    return { groupId: group.id, status: 'disabled' }
  }

  if (group.join_mode === 'approval') {
    // Create a pending join request
    const { error: reqError } = await supabase.from('group_join_requests').insert({
      group_id: group.id,
      requester: w,
      invited_by: inv.created_by,
      request_type: 'link' as const,
      status: 'pending' as const,
    })

    if (reqError) throw new Error(`joinViaInviteToken (request): ${reqError.message}`)
    return { groupId: group.id, status: 'pending' }
  }

  // join_mode === 'free' -> add directly
  await addGroupMembers(group.id, [w])
  return { groupId: group.id, status: 'joined' }
}

/** 21b. Preview group info by invite token (lightweight, no side effects) */
export async function fetchGroupPreviewByToken(
  token: string,
): Promise<{ name: string; memberCount: number; avatarUrl?: string } | null> {
  const { data: invite } = await supabase
    .from('group_invites')
    .select('group_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (!invite) return null
  const inv = invite as { group_id: string; expires_at: string | null }

  // Check expiry
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return null

  const { data: group } = await supabase
    .from('groups')
    .select('name, members, avatar_url')
    .eq('id', inv.group_id)
    .maybeSingle()

  if (!group) return null
  return {
    name: (group as any).name,
    memberCount: ((group as any).members || []).length,
    avatarUrl: (group as any).avatar_url || undefined,
  }
}

/** 22. Invite friends to a group */
export async function inviteFriendsToGroup(
  groupId: string,
  wallets: string[],
  invitedBy: string,
  needApproval: boolean,
): Promise<void> {
  const normalized = wallets.map((w) => w.toLowerCase())
  const inviter = invitedBy.toLowerCase()

  if (needApproval) {
    const rows = normalized.map((w) => ({
      group_id: groupId,
      requester: w,
      invited_by: inviter,
      request_type: 'invite' as const,
      status: 'pending' as const,
    }))

    const { error } = await supabase.from('group_join_requests').insert(rows)
    if (error) throw new Error(`inviteFriendsToGroup: ${error.message}`)
  } else {
    await addGroupMembers(groupId, normalized)
  }
}

/** 23. Fetch pending join requests for a group */
export async function fetchJoinRequests(groupId: string): Promise<GroupJoinRequestRow[]> {
  const { data, error } = await supabase
    .from('group_join_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw new Error(`fetchJoinRequests: ${error.message}`)
  return (data ?? []) as GroupJoinRequestRow[]
}

/** 24. Handle a join request (approve or reject) */
export async function handleJoinRequest(
  requestId: number,
  action: 'approved' | 'rejected',
  handledBy: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('group_join_requests')
    .update({
      status: action,
      handled_by: handledBy.toLowerCase(),
      handled_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select()

  if (error) throw new Error(`handleJoinRequest: ${error.message}`)

  // If no rows updated (already handled), silently skip
  if (!data || data.length === 0) return

  // If approved, add the requester to the group
  if (action === 'approved') {
    const request = data[0] as GroupJoinRequestRow
    await addGroupMembers(request.group_id, [request.requester])
  }
}

// ─── Group Avatar ────────────────────────────────────────────────────

const GROUP_AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const GROUP_AVATAR_MAX_SIZE = 2 * 1024 * 1024 // 2MB

/** 25. Upload group avatar to Storage and return public URL */
export async function uploadGroupAvatar(groupId: string, file: File): Promise<string> {
  if (!GROUP_AVATAR_ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Invalid file type. Only jpg, png, gif, webp are allowed.')
  }
  if (file.size > GROUP_AVATAR_MAX_SIZE) {
    throw new Error('File too large. Maximum size is 2MB.')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${groupId}/${crypto.randomUUID()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('group-avatars')
    .upload(fileName, file, { upsert: true })

  if (uploadError) throw new Error(`uploadGroupAvatar: ${uploadError.message}`)

  const { data } = supabase.storage.from('group-avatars').getPublicUrl(fileName)
  return data.publicUrl
}

/** 26. Update group avatar_url in the database */
export async function updateGroupAvatar(groupId: string, avatarUrl: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ avatar_url: avatarUrl })
    .eq('id', groupId)

  if (error) throw new Error(`updateGroupAvatar: ${error.message}`)
}

/** 27. Update my personal group settings (upsert) */
export async function updateMyGroupSettings(
  groupId: string,
  wallet: string,
  data: Partial<{
    group_nickname: string | null
    pinned: boolean
    muted_notifications: boolean
    last_read_announcement_at: string
  }>,
): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .upsert(
      {
        group_id: groupId,
        wallet_address: wallet.toLowerCase(),
        ...data,
      },
      { onConflict: 'group_id,wallet_address' },
    )

  if (error) throw new Error(`updateMyGroupSettings: ${error.message}`)
}
