import { supabase, getChatId } from '@/lib/supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

// ======== Re-export getChatId for consumers ========
export { getChatId }

// ======== Helper: address color from hash ========

export function addressToColor(address: string): string {
  const colors = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#f97316', '#ef4444',
    '#84cc16', '#a78bfa',
  ]
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// ======== Row types (matches DB schema) ========

export interface ContactRow {
  id: number
  created_at: string
  wallet_a: string
  wallet_b: string
  status: 'pending' | 'accepted' | 'rejected'
  request_msg: string | null
}

export interface MessageRow {
  id: number
  created_at: string
  chat_id: string
  sender: string
  content: string
  msg_type: 'text' | 'system'
}

export interface GroupRow {
  id: string
  created_at: string
  name: string
  creator: string
  members: string[]
}

// ======== Friend Requests ========

/**
 * Send a friend request from → to.
 * Uses upsert with onConflict do nothing to handle duplicate gracefully.
 */
export async function sendFriendRequest(
  from: string,
  to: string,
  message?: string
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .upsert(
      {
        wallet_a: from.toLowerCase(),
        wallet_b: to.toLowerCase(),
        status: 'pending',
        request_msg: message || null,
      },
      { onConflict: 'wallet_a,wallet_b', ignoreDuplicates: true }
    )
  if (error) throw error
}

/**
 * Accept a friend request: the sender is fromAddress, recipient is myAddress.
 * DB row: wallet_a = fromAddress, wallet_b = myAddress
 */
export async function acceptFriendRequest(
  myAddress: string,
  fromAddress: string
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ status: 'accepted' })
    .eq('wallet_a', fromAddress.toLowerCase())
    .eq('wallet_b', myAddress.toLowerCase())
  if (error) throw error
}

/**
 * Reject a friend request: the sender is fromAddress, recipient is myAddress.
 */
export async function rejectFriendRequest(
  myAddress: string,
  fromAddress: string
): Promise<void> {
  const { error } = await supabase
    .from('contacts')
    .update({ status: 'rejected' })
    .eq('wallet_a', fromAddress.toLowerCase())
    .eq('wallet_b', myAddress.toLowerCase())
  if (error) throw error
}

/**
 * Fetch all accepted contacts for myAddress (both directions).
 * Returns array of peer addresses (lowercase).
 */
export async function fetchContacts(myAddress: string): Promise<ContactRow[]> {
  const me = myAddress.toLowerCase()
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('status', 'accepted')
    .or(`wallet_a.eq.${me},wallet_b.eq.${me}`)
  if (error) throw error
  return (data || []) as ContactRow[]
}

/**
 * Fetch pending friend requests sent TO myAddress.
 */
export async function fetchPendingRequests(myAddress: string): Promise<ContactRow[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('wallet_b', myAddress.toLowerCase())
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data || []) as ContactRow[]
}

/**
 * Check if two addresses are already friends (either direction).
 */
export async function areFriends(addrA: string, addrB: string): Promise<boolean> {
  const a = addrA.toLowerCase()
  const b = addrB.toLowerCase()
  const { data, error } = await supabase
    .from('contacts')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(wallet_a.eq.${a},wallet_b.eq.${b}),and(wallet_a.eq.${b},wallet_b.eq.${a})`)
    .limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}

// ======== Messages ========

/**
 * Send a message to a chat (1-on-1 or group).
 */
export async function sendMessage(
  chatId: string,
  sender: string,
  content: string,
  msgType: 'text' | 'system' = 'text'
): Promise<MessageRow> {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender: sender.toLowerCase(),
      content,
      msg_type: msgType,
    })
    .select()
    .single()
  if (error) throw error
  return data as MessageRow
}

/**
 * Fetch message history for a chat, ordered oldest → newest.
 */
export async function fetchMessages(chatId: string, limit = 50): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(limit)
  if (error) throw error
  return (data || []) as MessageRow[]
}

/**
 * Fetch the single latest message for each of the given chat IDs.
 * Returns a map: chatId → MessageRow | null
 */
export async function fetchLastMessages(
  chatIds: string[]
): Promise<Record<string, MessageRow | null>> {
  if (chatIds.length === 0) return {}

  // Fetch all messages for the given chat IDs, ordered newest first
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .in('chat_id', chatIds)
    .order('created_at', { ascending: false })

  if (error) throw error

  // Client-side: take first occurrence per chat_id (newest)
  const result: Record<string, MessageRow | null> = {}
  for (const chatId of chatIds) result[chatId] = null
  for (const msg of (data || []) as MessageRow[]) {
    if (result[msg.chat_id] === null) {
      result[msg.chat_id] = msg
    }
  }
  return result
}

// ======== Groups ========

/**
 * Create a new group chat. Returns the new group's id (used as chat_id for messages).
 */
export async function createGroup(
  creator: string,
  name: string,
  memberAddresses: string[]
): Promise<GroupRow> {
  const members = Array.from(
    new Set([creator.toLowerCase(), ...memberAddresses.map((a) => a.toLowerCase())])
  )

  const { data: group, error } = await supabase
    .from('groups')
    .insert({ name, creator: creator.toLowerCase(), members })
    .select()
    .single()
  if (error) throw error

  const groupData = group as GroupRow

  // Insert a system message to mark group creation
  await supabase.from('messages').insert({
    chat_id: groupData.id,
    sender: creator.toLowerCase(),
    content: name
      ? `群组「${name}」已创建`
      : `群组已创建（${members.length} 人）`,
    msg_type: 'system',
  })

  return groupData
}

/**
 * Fetch all groups where myAddress is a member.
 */
export async function fetchGroups(myAddress: string): Promise<GroupRow[]> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .contains('members', [myAddress.toLowerCase()])
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as GroupRow[]
}

// ======== Realtime ========

export interface ChatRealtimeCallbacks {
  onNewMessage: (msg: MessageRow) => void
  onNewRequest: (contact: ContactRow) => void
  onContactUpdate: (contact: ContactRow) => void
}

/**
 * Subscribe to all real-time events for a user's chat session.
 * Returns the RealtimeChannel for later cleanup.
 */
export function subscribeToChat(
  myAddress: string,
  myChatIds: string[],
  callbacks: ChatRealtimeCallbacks
): RealtimeChannel {
  const me = myAddress.toLowerCase()

  const channel = supabase
    .channel(`chat-${me}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload) => {
        const msg = payload.new as MessageRow
        // Client-side filter: only handle messages for chats I'm in
        if (myChatIds.includes(msg.chat_id)) {
          callbacks.onNewMessage(msg)
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'contacts',
        filter: `wallet_b=eq.${me}`,
      },
      (payload) => {
        callbacks.onNewRequest(payload.new as ContactRow)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'contacts',
        filter: `wallet_a=eq.${me}`,
      },
      (payload) => {
        callbacks.onContactUpdate(payload.new as ContactRow)
      }
    )
    .subscribe()

  return channel
}

/**
 * Unsubscribe and remove the Realtime channel.
 */
export async function unsubscribeChat(channel: RealtimeChannel | null): Promise<void> {
  if (!channel) return
  await supabase.removeChannel(channel)
}
