import { PushAPI, CONSTANTS } from '@pushprotocol/restapi'
import type { Signer } from 'ethers'
import { utils as ethersUtils } from 'ethers'
import type { IFeeds, IMessageIPFS } from '@pushprotocol/restapi'
import type { Chat, Message, ChatRequest } from '@/lib/store'

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

// ======== Helper: strip eip155 prefix ========

function stripEip155Prefix(did: string): string {
  if (!did) return did
  // eip155:1:0x... → 0x...
  const match = did.match(/eip155:\d+:(0x[a-fA-F0-9]+)/)
  if (match) return match[1]
  // eip155:0x... → 0x...
  const match2 = did.match(/eip155:(0x[a-fA-F0-9]+)/)
  if (match2) return match2[1]
  return did
}

// ======== Push Protocol Initialization ========

export async function initPushUser(signer: Signer): Promise<PushAPI> {
  // Default to PROD; only use STAGING if explicitly set (local dev via .env.local)
  const env = process.env.NEXT_PUBLIC_PUSH_ENV === 'staging'
    ? CONSTANTS.ENV.STAGING
    : CONSTANTS.ENV.PROD

  const pushUser = await PushAPI.initialize(signer as any, { env })

  // Initialize stream for real-time events, then connect
  await pushUser.initStream([CONSTANTS.STREAM.CHAT])
  pushUser.stream.connect()

  return pushUser
}

// ======== Chat List ========

export async function fetchChats(pushUser: PushAPI): Promise<IFeeds[]> {
  return pushUser.chat.list('CHATS')
}

export async function fetchChatRequests(pushUser: PushAPI): Promise<IFeeds[]> {
  return pushUser.chat.list('REQUESTS')
}

// ======== Friend Requests ========

export async function sendChatRequest(
  pushUser: PushAPI,
  address: string,
  message: string
): Promise<void> {
  // Normalize to EIP-55 checksum format before sending
  let normalizedAddress = address
  try {
    normalizedAddress = ethersUtils.getAddress(address)
  } catch { /* keep original */ }

  const content = message.trim() || '你好，我想加你为好友'
  await pushUser.chat.send(normalizedAddress, { content, type: 'Text' })
}

export async function acceptChatRequest(
  pushUser: PushAPI,
  address: string
): Promise<void> {
  await pushUser.chat.accept(address)
}

export async function rejectChatRequest(
  pushUser: PushAPI,
  address: string
): Promise<void> {
  await pushUser.chat.reject(address)
}

// ======== Messages ========

export async function sendMessage(
  pushUser: PushAPI,
  address: string,
  content: string
): Promise<void> {
  await pushUser.chat.send(address, { content, type: 'Text' })
}

export async function fetchChatHistory(
  pushUser: PushAPI,
  address: string,
  limit = 30
): Promise<IMessageIPFS[]> {
  return pushUser.chat.history(address, { limit })
}

// ======== User Info ========

export async function getUserInfo(
  pushUser: PushAPI,
  address: string
): Promise<any> {
  // Normalize to EIP-55 checksum format before calling Push Protocol API
  let normalizedAddress = address
  try {
    normalizedAddress = ethersUtils.getAddress(address)
  } catch { /* keep original */ }

  try {
    const info = await pushUser.profile.info({ overrideAccount: normalizedAddress })
    if (info) return info
  } catch {
    // ignore — fall through to synthetic fallback
  }
  // Any valid EVM address is treated as a searchable OGBO user.
  // Push Protocol auto-creates a profile on first message/request.
  if (/^0x[a-fA-F0-9]{40}$/i.test(normalizedAddress)) {
    return { address: normalizedAddress, did: `eip155:1:${normalizedAddress}`, name: null, _synthetic: true }
  }
  return null
}

// ======== Group Chat ========

/**
 * Create a Push Protocol group chat.
 * Returns { chatId, name } where chatId is the unique group identifier.
 */
export async function createGroupChat(
  pushUser: PushAPI,
  groupName: string,
  memberAddresses: string[]
): Promise<{ chatId: string; name: string }> {
  // Runtime guard: ensure group.create API exists in this SDK version
  if (typeof (pushUser.chat as any)?.group?.create !== 'function') {
    throw new Error('Push Protocol group.create API is not available in this environment')
  }

  // EIP-55 checksum normalization + deduplication
  // (Push Protocol API rejects non-checksummed addresses)
  const seen = new Set<string>()
  const normalizedMembers: string[] = []
  for (const addr of memberAddresses) {
    try {
      const checksummed = ethersUtils.getAddress(addr)
      const key = checksummed.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        normalizedMembers.push(checksummed)
      }
    } catch {
      // Invalid address format: keep original, let API return the error
      const key = addr.toLowerCase()
      if (!seen.has(key)) {
        seen.add(key)
        normalizedMembers.push(addr)
      }
    }
  }

  const response = await (pushUser.chat.group as any).create(groupName, {
    description: '',
    members: normalizedMembers,
    admins: [],
    isPublic: false,
  })

  // Log raw response to aid debugging — field names vary across SDK versions
  console.log('[createGroupChat] raw response:', JSON.stringify(response))

  // GroupDTO fields: chatId / groupChatId / id / chatid (varies by SDK version)
  const chatId: string =
    response?.chatId || response?.groupChatId || response?.id || response?.chatid || ''
  const name: string = response?.groupName || groupName

  if (!chatId) {
    throw new Error(
      'createGroupChat: chatId missing from response. Raw: ' + JSON.stringify(response)
    )
  }
  return { chatId, name }
}

/**
 * Auto-accept group chat invitations from friends.
 * Only accepts group invites where the creator is in friendAddresses.
 * Silently continues if individual accepts fail.
 */
export async function autoAcceptFriendGroupInvites(
  pushUser: PushAPI,
  friendAddresses: string[]
): Promise<void> {
  try {
    const requests = await pushUser.chat.list('REQUESTS')
    for (const req of requests) {
      const groupInfo = (req as any).groupInformation
      if (!groupInfo) continue  // skip 1-on-1 requests
      try {
        const creatorAddr = stripEip155Prefix(groupInfo.groupCreator || '')
        const isFriend = friendAddresses.some(
          (f) => f.toLowerCase() === creatorAddr.toLowerCase()
        )
        if (isFriend && req.chatId) {
          await pushUser.chat.accept(req.chatId)
        }
      } catch {
        // individual accept failure: continue to next
      }
    }
  } catch {
    // fetch requests failed: silent, do not throw
  }
}

// ======== Real-time Listeners ========

export function setupSocketListeners(
  pushUser: PushAPI,
  callbacks: {
    onMessage: (data: any) => void
    onRequest: (data: any) => void | Promise<void>
    onAccept: (data: any) => void
  }
): () => void {
  const { STREAM } = CONSTANTS

  pushUser.stream.on(STREAM.CHAT, (data: any) => {
    if (data.event === 'chat.message') callbacks.onMessage(data)
    if (data.event === 'chat.request') callbacks.onRequest(data)
    if (data.event === 'chat.accept') callbacks.onAccept(data)
  })

  return () => {
    try {
      pushUser.stream.removeAllListeners()
      pushUser.stream.disconnect()
    } catch {
      // ignore
    }
  }
}

// ======== Helper: normalize timestamp ========
// Push Protocol REST API returns timestamp as number (ms).
// Stream events return timestamp as a numeric string (e.g. "1706745600000").
// new Date("1706745600000") is Invalid Date → NaN:NaN, so we must convert to number first.

function normalizeTimestamp(raw: any): number {
  if (typeof raw === 'number' && raw > 0) return raw
  if (raw) {
    const parsed = Number(raw)
    if (!isNaN(parsed) && parsed > 0) return parsed
  }
  return Date.now()
}

// ======== Data Adapters ========

export function pushFeedToChat(feed: IFeeds, myAddress: string): Chat {
  // ---- Group chat feed ----
  const groupInfo = (feed as any).groupInformation
  if (groupInfo) {
    return {
      id: feed.chatId || '',
      name: groupInfo.groupName || 'Group Chat',
      avatarColor: addressToColor(feed.chatId || ''),
      lastMessage: (feed.msg as any)?.messageContent || '',
      timestamp: normalizeTimestamp((feed.msg as any)?.timestamp),
      unread: (feed as any).count ?? 0,
      online: false,
      typing: false,
      type: 'group',
      members: groupInfo.members?.length ?? 0,
      pinned: false,
      messages: [],
      walletAddress: undefined,
      pushChatId: feed.chatId,
      did: undefined,
    }
  }

  // ---- Personal (1-on-1) chat feed ----
  const peerDid = feed.did || (feed as any).walletAddress || ''
  const peerAddress = stripEip155Prefix(peerDid) || (feed as any).intentSentBy || ''
  const shortName = peerAddress
    ? `${peerAddress.slice(0, 6)}...${peerAddress.slice(-4)}`
    : 'Unknown'

  return {
    id: feed.chatId || peerAddress,
    name: shortName,
    avatarColor: addressToColor(peerAddress),
    lastMessage: (feed.msg as any)?.messageContent || '',
    timestamp: normalizeTimestamp((feed.msg as any)?.timestamp),
    unread: (feed as any).count || 0,
    online: false,
    typing: false,
    type: 'personal',
    messages: [],
    walletAddress: peerAddress,
    pushChatId: feed.chatId,
    did: peerDid,
  }
}

export function pushMessageToMessage(msg: IMessageIPFS, myAddress: string): Message {
  const fromDid = (msg as any).fromDID || (msg as any).from || ''
  const fromAddress = stripEip155Prefix(fromDid)
  const isMine = myAddress && fromAddress.toLowerCase() === myAddress.toLowerCase()
  // REST API uses 'cid'; stream events use 'reference' for the message CID
  const cid = (msg as any).cid || (msg as any).reference || undefined
  const timestamp = normalizeTimestamp((msg as any).timestamp)
  const content = (msg as any).messageContent || (msg as any).message?.content || ''

  return {
    id: cid || String(timestamp),
    sender: isMine ? 'me' : fromAddress,
    content,
    timestamp,
    status: 'sent',
    pushMessageId: cid,
  }
}

export function pushRequestToChatRequest(feed: IFeeds): ChatRequest {
  const fromDid = feed.did || (feed as any).from || ''
  const fromAddress = stripEip155Prefix(fromDid) || (feed as any).intentSentBy || ''

  return {
    fromAddress,
    fromDID: fromDid,
    message: (feed.msg as any)?.messageContent || '',
    timestamp: normalizeTimestamp((feed.msg as any)?.timestamp),
    chatId: feed.chatId || '',
  }
}
