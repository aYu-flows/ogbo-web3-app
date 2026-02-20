import { PushAPI, CONSTANTS } from '@pushprotocol/restapi'
import type { Signer } from 'ethers'
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
  const content = message.trim() || '你好，我想加你为好友'
  await pushUser.chat.send(address, { content, type: 'Text' })
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
  try {
    return await pushUser.profile.info({ overrideAccount: address })
  } catch {
    return null
  }
}

// ======== Real-time Listeners ========

export function setupSocketListeners(
  pushUser: PushAPI,
  callbacks: {
    onMessage: (data: any) => void
    onRequest: (data: any) => void
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

// ======== Data Adapters ========

export function pushFeedToChat(feed: IFeeds, myAddress: string): Chat {
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
    timestamp: (feed.msg as any)?.timestamp || Date.now(),
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

  return {
    id: (msg as any).cid || String((msg as any).timestamp || Date.now()),
    sender: isMine ? 'me' : fromAddress,
    content: (msg as any).messageContent || (msg as any).message?.content || '',
    timestamp: (msg as any).timestamp || Date.now(),
    status: 'sent',
    pushMessageId: (msg as any).cid,
  }
}

export function pushRequestToChatRequest(feed: IFeeds): ChatRequest {
  const fromDid = feed.did || (feed as any).from || ''
  const fromAddress = stripEip155Prefix(fromDid) || (feed as any).intentSentBy || ''

  return {
    fromAddress,
    fromDID: fromDid,
    message: (feed.msg as any)?.messageContent || '',
    timestamp: (feed.msg as any)?.timestamp || Date.now(),
    chatId: feed.chatId || '',
  }
}
