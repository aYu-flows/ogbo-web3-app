import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Signer } from 'ethers'
import { getStoredWallets, getActiveWallet, saveExternalWallet, removeExternalWallet, setActiveWalletId, type StoredWallet as StoredWalletType } from '@/lib/walletCrypto'
import { supabase } from '@/lib/supabaseClient'
import { getChatId, addressToColor } from '@/lib/chat'
import type { ContactRow, MessageRow, GroupRow } from '@/lib/chat'
import { playMessageSound, getActiveChatId } from '@/lib/soundPlayer'
import type { ProfileData } from '@/lib/profile'
import type { GroupMemberRow, GroupMuteRow, GroupDetail, GroupJoinRequestRow, GroupInviteRow, GroupRole } from '@/lib/group-management'
import { MutedError } from '@/lib/group-management'

// ======== CoinGecko Market Data ========
interface CoinGeckoMarketItem {
  id: string
  current_price: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  price_change_percentage_24h: number | null
  circulating_supply: number
  total_supply: number | null
  max_supply: number | null
}

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
export const MARKET_CACHE_KEY = 'ogbo_market_data_cache'

export interface MarketCacheEntry {
  id: string
  price: number
  change24h: number
  volume: string
  marketCap: string
  high24h: number
  low24h: number
  supply: string
  maxSupply: string
  chartData: { time: number; price: number }[]
}

export function saveMarketCache(coins: Coin[]): void {
  if (typeof window === 'undefined') return
  try {
    const cache: MarketCacheEntry[] = coins
      .filter(c => c.price > 0)
      .map(({ id, price, change24h, volume, marketCap, high24h, low24h, supply, maxSupply, chartData }) => ({
        id, price, change24h, volume, marketCap, high24h, low24h, supply, maxSupply, chartData,
      }))
    localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(cache))
  } catch { /* ignore quota errors or SSR */ }
}

export function loadMarketCache(): MarketCacheEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MarketCacheEntry[]
  } catch { return [] }
}

// --- Built-in market data snapshot (CoinGecko data as of 2026-02-23) ---
// Used as initial fallback for first-time users with no network access.
// A simple 24-point sinusoidal chart is generated per coin for visual display.
// Real chart data replaces this as soon as network is available.
const MOCK_CHART_RATIOS = [
  1.044, 1.042, 1.040, 1.043, 1.041, 1.036, 1.046, 1.048,
  1.044, 1.039, 1.031, 1.026, 1.021, 1.016, 1.013, 1.011,
  1.009, 1.006, 1.001, 0.999, 0.998, 0.997, 0.999, 1.000,
]
const MOCK_BASE_TIME = 1740337200000 // 2026-02-23T11:00:00Z (fixed anchor)
function buildMockChart(price: number): { time: number; price: number }[] {
  return MOCK_CHART_RATIOS.map((r, i) => ({ time: MOCK_BASE_TIME + i * 3600000, price: price * r }))
}

const BUILT_IN_MARKET_MOCK: MarketCacheEntry[] = [
  { id: 'bitcoin',          price: 64704,     change24h: -3.99144,  volume: '50.09B',  marketCap: '1.30T',   high24h: 67695,     low24h: 64425,     supply: '19.99M',  maxSupply: '21.00M',  chartData: buildMockChart(64704) },
  { id: 'ethereum',         price: 1859.26,   change24h: -4.26409,  volume: '22.59B',  marketCap: '224.90B', high24h: 1958.6,    low24h: 1845.98,   supply: '120.69M', maxSupply: '∞',       chartData: buildMockChart(1859.26) },
  { id: 'ripple',           price: 1.37,      change24h: -1.79745,  volume: '3.44B',   marketCap: '83.40B',  high24h: 1.42,      low24h: 1.34,      supply: '61.02B',  maxSupply: '100.00B', chartData: buildMockChart(1.37) },
  { id: 'binancecoin',      price: 596.32,    change24h: -2.51601,  volume: '1.45B',   marketCap: '81.50B',  high24h: 615.83,    low24h: 585.83,    supply: '136.36M', maxSupply: '200.00M', chartData: buildMockChart(596.32) },
  { id: 'solana',           price: 78.33,     change24h: -5.73523,  volume: '4.86B',   marketCap: '44.47B',  high24h: 83.54,     low24h: 77.32,     supply: '568.47M', maxSupply: '∞',       chartData: buildMockChart(78.33) },
  { id: 'tron',             price: 0.281915,  change24h: -3.03778,  volume: '631.30M', marketCap: '26.70B',  high24h: 0.291002,  low24h: 0.281785,  supply: '94.74B',  maxSupply: '∞',       chartData: buildMockChart(0.281915) },
  { id: 'dogecoin',         price: 0.093931,  change24h: -1.07405,  volume: '1.03B',   marketCap: '15.89B',  high24h: 0.097358,  low24h: 0.091894,  supply: '168.83B', maxSupply: '∞',       chartData: buildMockChart(0.093931) },
  { id: 'bitcoin-cash',     price: 526.83,    change24h: -7.64023,  volume: '384.46M', marketCap: '10.55B',  high24h: 572.74,    low24h: 527.36,    supply: '20.00M',  maxSupply: '21.00M',  chartData: buildMockChart(526.83) },
  { id: 'cardano',          price: 0.26408,   change24h: -2.11833,  volume: '450.59M', marketCap: '9.72B',   high24h: 0.273903,  low24h: 0.258928,  supply: '36.81B',  maxSupply: '45.00B',  chartData: buildMockChart(0.26408) },
  { id: 'hyperliquid',      price: 26.0,      change24h: -10.19582, volume: '264.23M', marketCap: '6.22B',   high24h: 29.01,     low24h: 25.89,     supply: '238.39M', maxSupply: '1.00B',   chartData: buildMockChart(26.0) },
  { id: 'wrapped-bitcoin',  price: 64393,     change24h: -4.16708,  volume: '171.35M', marketCap: '7.79B',   high24h: 67472,     low24h: 64027,     supply: '120.73K', maxSupply: '∞',       chartData: buildMockChart(64393) },
  { id: 'leo-token',        price: 8.08,      change24h: -1.04536,  volume: '3.30M',   marketCap: '7.45B',   high24h: 8.34,      low24h: 7.93,      supply: '921.31M', maxSupply: '∞',       chartData: buildMockChart(8.08) },
  { id: 'monero',           price: 311.45,    change24h: -3.11795,  volume: '84.47M',  marketCap: '5.74B',   high24h: 328.23,    low24h: 307.88,    supply: '18.45M',  maxSupply: '∞',       chartData: buildMockChart(311.45) },
  { id: 'chainlink',        price: 8.29,      change24h: -3.99467,  volume: '371.26M', marketCap: '5.88B',   high24h: 8.69,      low24h: 8.19,      supply: '708.10M', maxSupply: '1.00B',   chartData: buildMockChart(8.29) },
  { id: 'stellar',          price: 0.151293,  change24h: -2.08703,  volume: '100.14M', marketCap: '4.97B',   high24h: 0.157003,  low24h: 0.14974,   supply: '32.86B',  maxSupply: '∞',       chartData: buildMockChart(0.151293) },
  { id: 'hedera-hashgraph', price: 0.094964,  change24h: -2.37653,  volume: '98.76M',  marketCap: '4.08B',   high24h: 0.098322,  low24h: 0.093733,  supply: '43.00B',  maxSupply: '50.00B',  chartData: buildMockChart(0.094964) },
]

const COIN_STATIC_LIST: Array<{ id: string; symbol: string; name: string; icon: string }> = [
  { id: 'bitcoin',          symbol: 'BTC',  name: 'Bitcoin',         icon: '₿' },
  { id: 'ethereum',         symbol: 'ETH',  name: 'Ethereum',        icon: 'Ξ' },
  { id: 'ripple',           symbol: 'XRP',  name: 'XRP',             icon: '✕' },
  { id: 'binancecoin',      symbol: 'BNB',  name: 'BNB',             icon: '◆' },
  { id: 'solana',           symbol: 'SOL',  name: 'Solana',          icon: 'S' },
  { id: 'tron',             symbol: 'TRX',  name: 'TRON',            icon: 'T' },
  { id: 'dogecoin',         symbol: 'DOGE', name: 'Dogecoin',        icon: 'D' },
  { id: 'bitcoin-cash',     symbol: 'BCH',  name: 'Bitcoin Cash',    icon: 'B' },
  { id: 'cardano',          symbol: 'ADA',  name: 'Cardano',         icon: 'A' },
  { id: 'hyperliquid',      symbol: 'HYPE', name: 'HyperLiquid',     icon: 'H' },
  { id: 'wrapped-bitcoin',  symbol: 'WBTC', name: 'Wrapped Bitcoin', icon: '₿' },
  { id: 'leo-token',        symbol: 'LEO',  name: 'LEO Token',       icon: 'L' },
  { id: 'monero',           symbol: 'XMR',  name: 'Monero',          icon: 'M' },
  { id: 'chainlink',        symbol: 'LINK', name: 'Chainlink',       icon: '⬡' },
  { id: 'stellar',          symbol: 'XLM',  name: 'Stellar',         icon: '✦' },
  { id: 'hedera-hashgraph', symbol: 'HBAR', name: 'Hedera',          icon: 'Ħ' },
]

const COINGECKO_IDS = COIN_STATIC_LIST.map(c => c.id).join(',')

export function formatLargeNumber(n: number | null | undefined): string {
  if (n == null || n === 0) return '--'
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9)  return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6)  return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3)  return (n / 1e3).toFixed(2) + 'K'
  return n.toFixed(4)
}

export function buildInitialCoins(): Coin[] {
  return COIN_STATIC_LIST.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    icon: c.icon,
    price: 0,
    change24h: 0,
    volume: '--',
    marketCap: '--',
    high24h: 0,
    low24h: 0,
    supply: '--',
    maxSupply: '--',
    chartData: [],
    favorited: false,
  }))
}

export type TabType = 'home' | 'chat' | 'market' | 'discover' | 'assets'
export type Locale = 'zh' | 'en'

export interface ChatRequest {
  id: number
  fromAddress: string
  message: string
  timestamp: number
}

export interface Token {
  symbol: string
  name: string
  amount: number
  value: number
  change24h: number
  icon: string
}

export interface NFT {
  id: string
  name: string
  collection: string
  floorPrice: number
  color: string
}

export interface Transaction {
  id: string
  type: 'send' | 'receive' | 'swap'
  amount: number
  symbol: string
  to?: string
  from?: string
  timestamp: number
  status: 'completed' | 'pending' | 'failed'
}

export interface Wallet {
  id: string
  name: string
  address: string
  balance: { cny: number; usd: number }
  tokens: Token[]
  nfts: NFT[]
  transactions: Transaction[]
  type?: 'imported' | 'external'
}

export interface Message {
  id: string
  sender: 'me' | string
  content: string
  timestamp: number
  status: 'sent' | 'delivered' | 'read' | 'failed'
  msgType?: 'text' | 'image' | 'file' | 'voice'
  fileUrl?: string
  fileName?: string
  fileSize?: number
  duration?: number
  thumbnailUrl?: string
  uploadProgress?: number
}

export interface Chat {
  id: string
  name: string
  avatarColor: string
  lastMessage: string
  timestamp: number
  unread: number
  online: boolean
  typing: boolean
  type: 'personal' | 'group'
  members?: number
  pinned?: boolean
  messages: Message[]
  walletAddress?: string
  groupAvatarUrl?: string
}

export interface Coin {
  id: string
  symbol: string
  name: string
  price: number
  change24h: number
  volume: string
  marketCap: string
  high24h: number
  low24h: number
  supply: string
  maxSupply: string
  icon: string
  chartData: { time: number; price: number }[]
  favorited: boolean
}

export interface DApp {
  id: string
  name: string
  category: string[]
  rating: number
  downloads: string
  favorites: number
  description: string
  url: string
  developer: string
  featured: boolean
  iconColor: string
  favorited: boolean
}

function generateChartData(points: number, basePrice: number): { time: number; price: number }[] {
  let price = basePrice
  return Array.from({ length: points }, (_, i) => {
    price += (Math.random() - 0.5) * basePrice * 0.02
    return { time: Date.now() - (points - i) * 3600000, price }
  })
}

/** 将 localStorage StoredWallet 转换为 store Wallet 视图对象（不含私密字段） */
function storedWalletToWallet(sw: StoredWalletType): Wallet {
  return {
    id: sw.id,
    name: sw.name,
    address: sw.address,
    balance: { cny: 0, usd: 0 },
    tokens: [],
    nfts: [],
    transactions: [],
    type: sw.type,
  }
}

// ======== Helper: message summary for lastMessage display ========

function getMessageSummary(msgType?: string | null, content?: string, fileName?: string | null): string {
  switch (msgType) {
    case 'image': return '[图片]'
    case 'voice': return '[语音]'
    case 'file': return `[文件] ${fileName || ''}`
    default: return content || ''
  }
}

// ======== Helper: map DB rows to Chat objects ========

function contactToChat(contact: ContactRow, myAddress: string, lastMsg: MessageRow | null): Chat {
  const me = myAddress.toLowerCase()
  const peerAddr = contact.wallet_a.toLowerCase() === me ? contact.wallet_b : contact.wallet_a
  const chatId = getChatId(me, peerAddr)
  return {
    id: chatId,
    name: `${peerAddr.slice(0, 6)}...${peerAddr.slice(-4)}`,
    avatarColor: addressToColor(peerAddr),
    lastMessage: lastMsg ? getMessageSummary(lastMsg.msg_type, lastMsg.content, lastMsg.file_name) : '',
    timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(contact.created_at).getTime(),
    unread: 0,
    online: false,
    typing: false,
    type: 'personal',
    walletAddress: peerAddr,
    messages: [],
  }
}

function groupToChat(group: GroupRow, lastMsg: MessageRow | null, mySettings?: GroupMemberRow): Chat {
  return {
    id: group.id,
    name: group.name,
    avatarColor: addressToColor(group.id),
    lastMessage: lastMsg ? getMessageSummary(lastMsg.msg_type, lastMsg.content, lastMsg.file_name) : '',
    timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(group.created_at).getTime(),
    unread: 0,
    online: false,
    typing: false,
    type: 'group',
    members: group.members.length,
    pinned: mySettings?.pinned ?? false,
    messages: [],
    groupAvatarUrl: (group as any).avatar_url || undefined,
  }
}

const mockDApps: DApp[] = [
  { id: '1', name: 'Uniswap', category: ['DeFi', 'DEX'], rating: 4.8, downloads: '1.2K', favorites: 256, description: '去中心化交易协议，采用自动做市商机制', url: 'https://app.uniswap.org', developer: 'Uniswap Labs', featured: true, iconColor: '#ff007a', favorited: false },
  { id: '2', name: 'OpenSea', category: ['NFT', 'Marketplace'], rating: 4.6, downloads: '980', favorites: 189, description: '全球最大的NFT交易市场', url: 'https://opensea.io', developer: 'OpenSea', featured: true, iconColor: '#2081e2', favorited: false },
  { id: '3', name: 'AAVE', category: ['DeFi', 'Lending'], rating: 4.7, downloads: '756', favorites: 198, description: '去中心化借贷协议', url: 'https://aave.com', developer: 'Aave', featured: true, iconColor: '#b6509e', favorited: false },
  { id: '4', name: 'Curve', category: ['DeFi', 'DEX'], rating: 4.5, downloads: '534', favorites: 167, description: '稳定币交易优化协议', url: 'https://curve.fi', developer: 'Curve Finance', featured: false, iconColor: '#ff6b6b', favorited: false },
  { id: '5', name: 'PancakeSwap', category: ['DeFi', 'DEX'], rating: 4.4, downloads: '1.5K', favorites: 312, description: 'BSC上最大的DEX', url: 'https://pancakeswap.finance', developer: 'PancakeSwap', featured: true, iconColor: '#d1884f', favorited: false },
  { id: '6', name: 'Rarible', category: ['NFT', 'Marketplace'], rating: 4.3, downloads: '456', favorites: 134, description: 'NFT创作和交易平台', url: 'https://rarible.com', developer: 'Rarible', featured: false, iconColor: '#feda03', favorited: false },
  { id: '7', name: 'Compound', category: ['DeFi', 'Lending'], rating: 4.6, downloads: '623', favorites: 178, description: '算法借贷协议', url: 'https://compound.finance', developer: 'Compound Labs', featured: false, iconColor: '#00d395', favorited: false },
  { id: '8', name: 'Axie Infinity', category: ['GameFi', 'NFT'], rating: 4.2, downloads: '2.3K', favorites: 456, description: '区块链宠物对战游戏', url: 'https://axieinfinity.com', developer: 'Sky Mavis', featured: true, iconColor: '#0055d5', favorited: false },
  { id: '9', name: 'Snapshot', category: ['DAO', 'Tools'], rating: 4.7, downloads: '345', favorites: 234, description: '链下投票治理平台', url: 'https://snapshot.org', developer: 'Snapshot Labs', featured: false, iconColor: '#f3ad18', favorited: false },
  { id: '10', name: '1inch', category: ['DeFi', 'DEX'], rating: 4.5, downloads: '876', favorites: 267, description: 'DEX聚合器，最优价格路由', url: 'https://1inch.io', developer: '1inch Network', featured: true, iconColor: '#94a6c3', favorited: false },
  { id: '11', name: 'Decentraland', category: ['Metaverse', 'GameFi'], rating: 4.1, downloads: '567', favorites: 189, description: '虚拟世界元宇宙平台', url: 'https://decentraland.org', developer: 'Decentraland', featured: false, iconColor: '#ff2d55', favorited: false },
  { id: '12', name: 'Mirror', category: ['Social', 'Tools'], rating: 4.4, downloads: '234', favorites: 156, description: 'Web3写作和发布平台', url: 'https://mirror.xyz', developer: 'Mirror', featured: false, iconColor: '#007aff', favorited: false },
]

interface AppState {
  activeTab: TabType
  locale: Locale
  isBalanceVisible: boolean
  currentWalletId: string
  wallets: Wallet[]
  chats: Chat[]
  coins: Coin[]
  dapps: DApp[]
  unreadChatCount: number
  notifications: number
  isLoggedIn: boolean
  walletAddress: string | null

  // Market data state
  marketLoading: boolean
  marketError: string | null

  // Supabase Realtime chat state
  chatReady: boolean
  isConnectingChat: boolean
  chatChannel: RealtimeChannel | null
  chatRequests: ChatRequest[]

  // Profile state
  myProfile: ProfileData | null
  profileCache: Record<string, ProfileData>

  // OTA state
  otaProgress: number | null
  otaDone: boolean

  // Group management state
  groupJoinedAtMap: Record<string, string>
  myGroupSettings: Record<string, GroupMemberRow>
  pendingRequestCounts: Record<string, number>
  myMuteStatus: Record<string, GroupMuteRow | null>
  activeGroupDetail: Record<string, GroupDetail>

  switchTab: (tab: TabType) => void
  toggleBalance: () => void
  switchLocale: () => void
  switchWallet: (id: string) => void
  toggleCoinFavorite: (coinId: string) => void
  toggleDAppFavorite: (dappId: string) => void
  markChatRead: (chatId: string) => void
  pinChat: (chatId: string) => void
  deleteChat: (chatId: string) => void
  deleteMessages: (chatId: string, messageIds: string[]) => void
  sendMessage: (chatId: string, content: string, sender?: string) => void
  initMarketData: () => Promise<void>
  updatePrices: () => Promise<void>
  getCurrentWallet: () => Wallet | undefined
  login: (address?: string) => void
  logout: () => void
  checkAuthStatus: () => void
  cleanupExternalWallet: (address: string) => void

  // Supabase chat actions
  initChat: (walletAddress: string) => Promise<void>
  destroyChat: () => void
  refreshChats: () => Promise<void>
  refreshChatRequests: () => Promise<void>
  acceptRequest: (fromAddress: string) => Promise<void>
  rejectRequest: (fromAddress: string) => Promise<void>
  sendFriendRequest: (address: string, message?: string) => Promise<{ mode: 'pending' | 'accepted' }>
  sendPushMessage: (address: string, content: string) => Promise<void>
  sendGroupPushMessage: (chatId: string, content: string) => Promise<void>
  sendMediaMessage: (chatId: string, file: File, msgType: 'image' | 'file' | 'voice', duration?: number) => Promise<void>
  retryMediaMessage: (chatId: string, messageId: string, file: File, msgType: 'image' | 'file' | 'voice', duration?: number) => Promise<void>
  loadChatHistory: (chatId: string) => Promise<void>
  searchUserByAddress: (address: string) => Promise<any>
  searchUserByNickname: (keyword: string) => Promise<Array<{ address: string; nickname: string; avatarUrl: string | null }>>
  createGroup: (groupName: string, memberAddresses: string[]) => Promise<void>

  // Group management actions
  loadGroupMemberSettings: (groupId: string) => Promise<void>
  updateGroupNickname: (groupId: string, nickname: string) => Promise<void>
  toggleGroupPin: (groupId: string) => Promise<void>
  toggleGroupDND: (groupId: string) => Promise<void>
  markAnnouncementRead: (groupId: string) => Promise<void>
  openGroupManagement: (groupId: string) => Promise<GroupDetail | null>
  setAdmin: (groupId: string, wallet: string) => Promise<void>
  unsetAdmin: (groupId: string, wallet: string) => Promise<void>
  transferGroupOwnership: (groupId: string, newOwner: string) => Promise<void>
  kickMember: (groupId: string, wallet: string) => Promise<void>
  leaveGroupAction: (groupId: string) => Promise<void>
  dissolveGroupAction: (groupId: string) => Promise<void>
  muteMember: (groupId: string, wallet: string, duration: import('@/lib/group-management').MuteDuration) => Promise<void>
  unmuteMember: (groupId: string, wallet: string) => Promise<void>
  toggleMuteAll: (groupId: string) => Promise<void>
  updateGroupNameAction: (groupId: string, name: string) => Promise<void>
  setAnnouncementAction: (groupId: string, text: string) => Promise<void>
  updateJoinMode: (groupId: string, mode: import('@/lib/group-management').JoinMode) => Promise<void>
  toggleInviteApproval: (groupId: string) => Promise<void>
  createGroupInvite: (groupId: string, expiresInDays: number | null) => Promise<GroupInviteRow>
  revokeGroupInvite: (inviteId: string) => Promise<void>
  joinGroupViaToken: (token: string) => Promise<{ status: string; groupId?: string }>
  inviteFriendsToGroupAction: (groupId: string, wallets: string[]) => Promise<void>
  fetchGroupJoinRequests: (groupId: string) => Promise<GroupJoinRequestRow[]>
  handleJoinRequestAction: (requestId: number, action: 'approved' | 'rejected', groupId?: string) => Promise<void>
  refreshGroupDetail: (groupId: string) => Promise<void>
  patchActiveGroupDetail: (groupId: string, patch: Partial<GroupDetail>) => void
  updateGroupAvatarAction: (groupId: string, file: File) => Promise<void>
  getGroupDisplayName: (groupId: string, address: string) => string

  // OTA actions
  setOtaProgress: (progress: number | null) => void
  setOtaDone: (done: boolean) => void

  // Profile actions
  loadMyProfile: (walletAddress: string) => Promise<void>
  updateNickname: (nickname: string) => Promise<void>
  updateAvatar: (file: File) => Promise<void>
  updateFriendPermission: (permission: import('@/lib/profile').FriendPermission) => Promise<void>
  loadProfiles: (walletAddresses: string[]) => Promise<void>
  getDisplayName: (walletAddress: string) => string
  getAvatarUrl: (walletAddress: string) => string | null
}

export const useStore = create<AppState>((set, get) => ({
  activeTab: 'chat',
  locale: 'zh',
  isBalanceVisible: true,
  currentWalletId: '',
  wallets: [],        // 由 checkAuthStatus() 在客户端从 localStorage 加载，SSR 安全
  chats: [],
  coins: buildInitialCoins(),
  dapps: mockDApps,
  unreadChatCount: 0,
  notifications: 3,
  isLoggedIn: false,
  walletAddress: null,

  // Market data initial state
  marketLoading: false,
  marketError: null,

  // Supabase chat initial state
  chatReady: false,
  isConnectingChat: false,
  chatChannel: null,
  chatRequests: [],

  // Profile initial state
  myProfile: null,
  profileCache: {},

  // OTA initial state
  otaProgress: null,
  otaDone: false,

  // Group management initial state
  groupJoinedAtMap: {},
  myGroupSettings: {},
  pendingRequestCounts: {},
  myMuteStatus: {},
  activeGroupDetail: {},

  switchTab: (tab) => set({ activeTab: tab }),
  toggleBalance: () => set((s) => ({ isBalanceVisible: !s.isBalanceVisible })),
  setOtaProgress: (progress) => set({ otaProgress: progress }),
  setOtaDone: (done) => set({ otaDone: done }),
  switchLocale: () => set((s) => ({ locale: s.locale === 'zh' ? 'en' : 'zh' })),
  switchWallet: (id) => {
    const state = get()
    const targetWallet = state.wallets.find(w => w.id === id)
    // If target wallet not found, or it has the same address as current chat wallet → just update UI
    if (!targetWallet || targetWallet.address.toLowerCase() === (state.walletAddress?.toLowerCase() ?? '')) {
      set({ currentWalletId: id })
      return
    }
    const newAddress = targetWallet.address
    // Tear down old chat subscription (sync)
    if (state.chatChannel) {
      supabase.removeChannel(state.chatChannel)
    }
    // Persist new address and active wallet to localStorage (both keys must stay in sync)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ogbo_wallet_address', newAddress)
    }
    setActiveWalletId(id) // keeps ogbo_active_wallet in sync with ogbo_wallet_address
    // Atomically update wallet + reset chat state → triggers initChat via app/page.tsx useEffect
    set({
      currentWalletId: id,
      walletAddress: newAddress,
      chatChannel: null,
      chatReady: false,
      isConnectingChat: false,
      chats: [],
      chatRequests: [],
      unreadChatCount: 0,
      myProfile: null,
      profileCache: {},
    })
  },
  toggleCoinFavorite: (coinId) =>
    set((s) => ({
      coins: s.coins.map((c) => (c.id === coinId ? { ...c, favorited: !c.favorited } : c)),
    })),
  toggleDAppFavorite: (dappId) =>
    set((s) => ({
      dapps: s.dapps.map((d) =>
        d.id === dappId ? { ...d, favorited: !d.favorited, favorites: d.favorited ? d.favorites - 1 : d.favorites + 1 } : d
      ),
    })),
  markChatRead: (chatId) =>
    set((s) => {
      const chats = s.chats.map((c) => (c.id === chatId ? { ...c, unread: 0 } : c))
      return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
    }),
  pinChat: (chatId) =>
    set((s) => ({
      chats: s.chats.map((c) => (c.id === chatId ? { ...c, pinned: !c.pinned } : c)),
    })),
  deleteChat: (chatId) =>
    set((s) => {
      const chats = s.chats.filter((c) => c.id !== chatId)
      return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
    }),
  deleteMessages: (chatId, messageIds) => {
    const state = get()
    if (!state.walletAddress) return
    const { addDeletedMessages } = require('@/lib/message-delete')
    addDeletedMessages(state.walletAddress, chatId, messageIds)
    set((s) => ({
      chats: s.chats.map(c => {
        if (c.id !== chatId) return c
        const remaining = c.messages.filter(m => !messageIds.includes(m.id))
        const lastMsg = remaining[remaining.length - 1]
        return {
          ...c,
          messages: remaining,
          lastMessage: lastMsg ? getMessageSummary(lastMsg.msgType, lastMsg.content, lastMsg.fileName) : '',
          timestamp: lastMsg?.timestamp ?? c.timestamp,
        }
      })
    }))
  },
  sendMessage: (chatId, content, sender = 'me') =>
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              lastMessage: content,
              timestamp: Date.now(),
              messages: [...c.messages, { id: `m${Date.now()}`, sender, content, timestamp: Date.now(), status: 'sent' as const }],
            }
          : c
      ),
    })),
  updatePrices: async () => {
    try {
      const res = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${COINGECKO_IDS}&order=market_cap_desc&per_page=20&price_change_percentage=24h`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: CoinGeckoMarketItem[] = await res.json()
      set((s) => ({
        marketError: null,
        coins: s.coins.map((c) => {
          const d = data.find(item => item.id === c.id)
          if (!d) return c
          const newPrice = d.current_price ?? c.price
          const newPoint = { time: Date.now(), price: newPrice }
          return {
            ...c,
            price: newPrice,
            change24h: d.price_change_percentage_24h ?? c.change24h,
            volume: formatLargeNumber(d.total_volume),
            marketCap: formatLargeNumber(d.market_cap),
            high24h: d.high_24h ?? c.high24h,
            low24h: d.low_24h ?? c.low24h,
            supply: formatLargeNumber(d.circulating_supply),
            maxSupply: d.max_supply != null ? formatLargeNumber(d.max_supply) : '∞',
            // 追加最新价格点（仅在 chartData 已有数据时才追加）
            chartData: c.chartData.length > 0
              ? [...c.chartData.slice(-23), newPoint]
              : c.chartData,
          }
        }),
      }))
      // Zustand set() 是同步的，此处 get().coins 已是更新后的最新数据
      saveMarketCache(get().coins)
    } catch {
      set({ marketError: 'network_error' })
      // 保留上次已知价格，不重置为 0
    }
  },
  initMarketData: async () => {
    const state = get()
    // 若已有真实价格数据，仅刷新价格，不重新拉取走势图
    const alreadyLoaded = state.coins.some(c => c.price > 0)

    if (!alreadyLoaded) {
      const cache = loadMarketCache()

      if (cache.length > 0) {
        // 有用户缓存：立即还原，跳过骨架屏，然后后台刷新价格
        set((s) => ({
          coins: s.coins.map(c => {
            const cached = cache.find(e => e.id === c.id)
            if (!cached) return c
            return { ...c, ...cached }
          }),
          marketLoading: false,
        }))
        await get().updatePrices()
        return
      }

      // 无用户缓存（首次安装）：立即显示内置快照，跳过骨架屏
      // 随后继续获取真实价格和走势图数据替换
      set((s) => ({
        coins: s.coins.map(c => {
          const mock = BUILT_IN_MARKET_MOCK.find(e => e.id === c.id)
          if (!mock) return c
          return { ...c, ...mock }
        }),
        marketLoading: false,
      }))
    }

    // Step 1: 拉取/刷新主行情数据
    await get().updatePrices()

    // Step 2: 首次加载时并发拉取16个代币走势图（含使用内置快照的情况）
    if (!alreadyLoaded) {
      await Promise.allSettled(
        COIN_STATIC_LIST.map(async (coin) => {
          try {
            const res = await fetch(
              `${COINGECKO_BASE}/coins/${coin.id}/market_chart?vs_currency=usd&days=1&interval=hourly`
            )
            // 429 Too Many Requests 与其他错误同等处理，降级生成 mock 走势图
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()
            const chartData = (json.prices as [number, number][]).map(
              ([time, price]) => ({ time, price })
            )
            set((s) => ({
              coins: s.coins.map(c => c.id === coin.id ? { ...c, chartData } : c),
            }))
          } catch {
            // 降级：用当前价格生成随机走势图（内置快照已有图，但可被更好的降级图替换）
            set((s) => {
              const found = s.coins.find(c => c.id === coin.id)
              if (!found || found.price === 0) return s
              return {
                coins: s.coins.map(c =>
                  c.id === coin.id ? { ...c, chartData: generateChartData(24, found.price) } : c
                ),
              }
            })
          }
        })
      )
      // 首次加载完成：将含真实/降级走势图的完整数据写入缓存
      saveMarketCache(get().coins)
      set({ marketLoading: false })
    }
  },
  getCurrentWallet: () => {
    const s = get()
    return s.wallets.find((w) => w.id === s.currentWalletId) || s.wallets[0]
  },
  login: (address?: string) => {
    const state = get()
    // Detect if the active chat address is changing (e.g. MetaMask account switch)
    const addressChanging = !!address &&
      address.toLowerCase() !== (state.walletAddress?.toLowerCase() ?? '')
    // If address is changing, tear down old chat subscription first
    if (addressChanging && state.chatChannel) {
      supabase.removeChannel(state.chatChannel)
    }
    let storedWallets = getStoredWallets()
    // 若 address 是外部钱包地址且尚未持久化到 localStorage，则先持久化
    if (address && !storedWallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
      saveExternalWallet(address)
      storedWallets = getStoredWallets() // 重新加载以包含新记录
    }
    const activeWallet = getActiveWallet()
    const wallets = storedWallets.map(storedWalletToWallet)
    const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
    // If address changed, reset chat state so initChat will re-run for new address
    const chatReset = addressChanging ? {
      chatChannel: null,
      chatReady: false,
      isConnectingChat: false,
      chats: [],
      chatRequests: [],
      unreadChatCount: 0,
      myProfile: null,
      profileCache: {},
      groupJoinedAtMap: {},
      myGroupSettings: {},
      pendingRequestCounts: {},
      myMuteStatus: {},
      activeGroupDetail: {},
    } : {}
    set({
      isLoggedIn: true,
      walletAddress: address || null,
      wallets,
      currentWalletId,
      ...chatReset,
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('ogbo_logged_in', 'true')
      if (address) localStorage.setItem('ogbo_wallet_address', address)
    }
  },
  logout: () => {
    // Clean up chat subscription
    const state = get()
    if (state.chatChannel) {
      supabase.removeChannel(state.chatChannel)
    }
    // 清除 sessionStorage 中的 session key（明文私钥）
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem('ogbo_session_pk') } catch { /* ignore */ }
    }
    set({
      isLoggedIn: false,
      walletAddress: null,
      chatChannel: null,
      chatReady: false,
      isConnectingChat: false,
      chats: [],
      chatRequests: [],
      unreadChatCount: 0,
      myProfile: null,
      profileCache: {},
      groupJoinedAtMap: {},
      myGroupSettings: {},
      pendingRequestCounts: {},
      myMuteStatus: {},
      activeGroupDetail: {},
    })
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ogbo_logged_in')
      localStorage.removeItem('ogbo_wallet_address')
      localStorage.removeItem('ogbox_hide_download_banner')
    }
  },
  checkAuthStatus: () => {
    if (typeof window === 'undefined') return
    const isLoggedIn = localStorage.getItem('ogbo_logged_in') === 'true'
    const savedAddress = localStorage.getItem('ogbo_wallet_address') || null
    let storedWallets = getStoredWallets()
    // 向后兼容：存量外部钱包用户的地址可能未写入 localStorage，在此补存
    if (savedAddress && !storedWallets.some(w => w.address.toLowerCase() === savedAddress.toLowerCase())) {
      saveExternalWallet(savedAddress)
      storedWallets = getStoredWallets()
    }
    const activeWallet = getActiveWallet()
    const wallets = storedWallets.map(storedWalletToWallet)
    // Reconcile currentWalletId: prefer the wallet whose address matches ogbo_wallet_address.
    // This prevents a stale ogbo_active_wallet (e.g. from an old session before fix1 was deployed)
    // from causing an AssetsPage ↔ Chat mismatch on page reload.
    const walletByAddress = savedAddress
      ? storedWallets.find(w => w.address.toLowerCase() === savedAddress.toLowerCase())
      : null
    const currentWalletId = walletByAddress?.id || activeWallet?.id || wallets[0]?.id || ''
    set({ isLoggedIn, walletAddress: savedAddress, wallets, currentWalletId })
  },

  cleanupExternalWallet: (address: string) => {
    removeExternalWallet(address)
    const storedWallets = getStoredWallets()
    const activeWallet = getActiveWallet()
    const wallets = storedWallets.map(storedWalletToWallet)
    const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
    // 同步更新 ogbo_wallet_address：改为第一个 imported 钱包地址，防止页面刷新时 checkAuthStatus 重新添加已断连的外部钱包
    if (typeof window !== 'undefined') {
      const firstImported = storedWallets.find((w) => w.type !== 'external' && w.keystore)
      if (firstImported) {
        localStorage.setItem('ogbo_wallet_address', firstImported.address)
      } else {
        localStorage.removeItem('ogbo_wallet_address')
      }
    }
    set({ wallets, currentWalletId })
  },

  // ======== Supabase Realtime Chat Actions ========

  initChat: async (walletAddress) => {
    const state = get()
    const me = walletAddress.toLowerCase()
    // Prevent double-init only when the same address is already ready or connecting
    if (state.walletAddress?.toLowerCase() === me && (state.chatReady || state.isConnectingChat)) return

    // Defensively remove any existing channel before re-initializing
    if (state.chatChannel) {
      supabase.removeChannel(state.chatChannel)
    }
    set({ isConnectingChat: true, chatChannel: null, chats: [], chatRequests: [], unreadChatCount: 0 })

    try {
      const {
        fetchContacts,
        fetchGroups,
        fetchPendingRequests,
        fetchLastMessages,
      } = await import('@/lib/chat')

      // Load contacts, groups, and pending requests in parallel
      const [contacts, groups, pendingRequests] = await Promise.all([
        fetchContacts(me),
        fetchGroups(me),
        fetchPendingRequests(me),
      ])

      // Compute all chat IDs
      const personalChatIds = contacts.map(c => {
        const peerAddr = c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
        return getChatId(me, peerAddr)
      })
      const groupChatIds = groups.map(g => g.id)
      const allChatIds = [...personalChatIds, ...groupChatIds]

      // Fetch last messages for all chats
      const lastMsgs = allChatIds.length > 0 ? await fetchLastMessages(allChatIds) : {}

      // Fetch group member settings and mute status for current user
      const { fetchGroupMembers, fetchMuteStatus } = await import('@/lib/group-management')
      let myGroupMemberRows: GroupMemberRow[] = []
      let myMuteRows: GroupMuteRow[] = []
      if (groups.length > 0) {
        const [memberResult, muteResult] = await Promise.all([
          supabase
            .from('group_members')
            .select('*')
            .eq('wallet_address', me)
            .in('group_id', groupChatIds),
          supabase
            .from('group_mutes')
            .select('*')
            .eq('wallet_address', me)
            .in('group_id', groupChatIds),
        ])
        myGroupMemberRows = (memberResult.data || []) as GroupMemberRow[]
        myMuteRows = (muteResult.data || []) as GroupMuteRow[]
      }
      const groupJoinedAtMap: Record<string, string> = {}
      const myGroupSettings: Record<string, GroupMemberRow> = {}
      const myMuteStatus: Record<string, GroupMuteRow | null> = {}
      for (const row of myGroupMemberRows) {
        groupJoinedAtMap[row.group_id] = row.joined_at
        myGroupSettings[row.group_id] = row
      }
      for (const gId of groupChatIds) {
        if (!groupJoinedAtMap[gId]) {
          // Fallback: use group created_at for groups without group_members row
          const g = groups.find(gr => gr.id === gId)
          if (g) groupJoinedAtMap[gId] = g.created_at
        }
        myMuteStatus[gId] = myMuteRows.find(m => m.group_id === gId) || null
      }

      // Filter deleted lastMessages before building Chat objects
      const { getDeletedMessageIds: getDelIds } = require('@/lib/message-delete')
      const filteredLastMsgs: typeof lastMsgs = {}
      for (const [cid, msg] of Object.entries(lastMsgs)) {
        if (msg && !getDelIds(me, cid).has(`db-${msg.id}`)) {
          filteredLastMsgs[cid] = msg
        }
      }

      // Build Chat objects
      const personalChats = contacts.map(c => {
        const peerAddr = c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
        const chatId = getChatId(me, peerAddr)
        return contactToChat(c, me, filteredLastMsgs[chatId] || null)
      })
      const groupChats = groups.map(g => groupToChat(g, filteredLastMsgs[g.id] || null, myGroupSettings[g.id]))
      const chats = [...personalChats, ...groupChats].sort((a, b) => b.timestamp - a.timestamp)

      // Build ChatRequest objects from pending incoming requests
      const chatRequests: ChatRequest[] = pendingRequests.map(c => ({
        id: c.id,
        fromAddress: c.wallet_a,
        message: c.request_msg || '',
        timestamp: new Date(c.created_at).getTime(),
      }))

      // Stale-check: if walletAddress changed while we were fetching, discard results
      if (get().walletAddress?.toLowerCase() !== me) return

      set({ chats, chatRequests, chatReady: true, groupJoinedAtMap, myGroupSettings, myMuteStatus })

      // Load profiles for current user and all contacts
      get().loadMyProfile(me)
      const peerAddresses = contacts.map(c =>
        c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
      )
      const groupMemberAddresses = groups.flatMap(g => g.members)
      const pendingRequestAddresses = pendingRequests.map(c => c.wallet_a)
      const allAddresses = [...new Set([...peerAddresses, ...groupMemberAddresses, ...pendingRequestAddresses])]
      get().loadProfiles(allAddresses)

      // Subscribe to Realtime events
      const channel = supabase
        .channel(`chat-${me}-${Date.now()}`)
        // New messages in any chat
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const msg = payload.new as MessageRow
            const currentState = get()
            // Dynamic filter: check if this message belongs to a chat we're in
            if (!currentState.chats.some(c => c.id === msg.chat_id)) return

            const myAddr = currentState.walletAddress?.toLowerCase() || ''
            const isMe = msg.sender.toLowerCase() === myAddr

            // 收到他人消息时播放提示音（用户正在查看该聊天时抑制）
            const isDND = currentState.myGroupSettings[msg.chat_id]?.muted_notifications === true
            if (!isMe && !isDND && !(currentState.activeTab === 'chat' && getActiveChatId() === msg.chat_id)) {
              playMessageSound()
            }

            // Check if this message was locally deleted (Realtime replay protection)
            const { getDeletedMessageIds: getDeleted } = require('@/lib/message-delete')
            const deletedIds = getDeleted(myAddr, msg.chat_id)
            if (deletedIds.has(`db-${msg.id}`)) return

            const msgSummary = getMessageSummary(msg.msg_type, msg.content, msg.file_name)
            const newMsg: Message = {
              id: `db-${msg.id}`,
              sender: isMe ? 'me' : msg.sender,
              content: msg.content,
              timestamp: new Date(msg.created_at).getTime(),
              status: 'sent',
              msgType: (msg.msg_type === 'text' || msg.msg_type === 'system') ? undefined : msg.msg_type as Message['msgType'],
              fileUrl: msg.file_url || undefined,
              fileName: msg.file_name || undefined,
              fileSize: msg.file_size || undefined,
              duration: msg.duration || undefined,
              thumbnailUrl: msg.thumbnail_url || undefined,
            }

            set((s) => {
              const chats = s.chats.map((c) => {
                if (c.id !== msg.chat_id) return c

                // Deduplicate own messages: replace optimistic message with confirmed one
                if (isMe) {
                  const isMediaMsg = msg.msg_type === 'image' || msg.msg_type === 'file' || msg.msg_type === 'voice'
                  const optIdx = c.messages.reduceRight((found, m, idx) => {
                    if (found !== -1) return found
                    if (!m.id.startsWith('opt-') || m.sender !== 'me') return -1
                    if (isMediaMsg) {
                      // Media: match by msgType + fileSize + time window (60s)
                      // fileName may differ (original vs sanitized by uploadChatFile), so use fileSize as stable identifier
                      if (m.msgType === msg.msg_type && m.fileSize === (msg.file_size || undefined) && Math.abs(m.timestamp - new Date(msg.created_at).getTime()) < 60000) return idx
                    } else {
                      // Text: match by content
                      if (m.content === msg.content) return idx
                    }
                    return -1
                  }, -1)
                  if (optIdx !== -1) {
                    const messages = [...c.messages]
                    messages[optIdx] = newMsg
                    return { ...c, lastMessage: msgSummary, timestamp: newMsg.timestamp, messages }
                  }
                }

                // Don't increment unread if user is currently viewing this chat
                const isActiveChat = getActiveChatId() === c.id
                return {
                  ...c,
                  lastMessage: msgSummary,
                  timestamp: newMsg.timestamp,
                  unread: c.unread + (isMe || isActiveChat ? 0 : 1),
                  messages: [...c.messages, newMsg],
                }
              })
              return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
            })
          }
        )
        // New incoming friend request (wallet_b = me)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'contacts',
            filter: `wallet_b=eq.${me}`,
          },
          (payload) => {
            const contact = payload.new as ContactRow
            if (contact.status === 'pending') {
              // Load requester's profile for display
              get().loadProfiles([contact.wallet_a])
              // Standard friend request: add to pending requests list
              set((s) => {
                const exists = s.chatRequests.some(
                  r => r.fromAddress.toLowerCase() === contact.wallet_a.toLowerCase()
                )
                if (exists) return {}
                return {
                  chatRequests: [
                    ...s.chatRequests,
                    {
                      id: contact.id,
                      fromAddress: contact.wallet_a,
                      message: contact.request_msg || '',
                      timestamp: new Date(contact.created_at).getTime(),
                    },
                  ],
                }
              })
            } else if (contact.status === 'accepted') {
              // allow_all mode: friend added directly, refresh chat list + notify
              get().loadProfiles([contact.wallet_a])
              get().refreshChats()
              playMessageSound()
              Promise.all([
                import('react-hot-toast'),
                import('@/lib/i18n'),
              ]).then(([{ default: toast }, { t }]) => {
                toast.success(t('friend.addedYou', get().locale))
              })
            }
          }
        )
        // Our sent request was accepted (wallet_a = me, status → accepted)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'contacts',
            filter: `wallet_a=eq.${me}`,
          },
          (payload) => {
            const contact = payload.new as ContactRow
            if (contact.status === 'accepted') {
              // Re-fetch chats to add the newly accepted friend
              get().refreshChats()
            }
          }
        )
        // New group created that includes me as a member
        // Note: Supabase Realtime doesn't support array-containment server-side filters,
        // so we subscribe to all groups INSERT and filter client-side.
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'groups' },
          (payload) => {
            const group = payload.new as GroupRow
            const myAddr = get().walletAddress?.toLowerCase() || me
            // Only act if I'm a member but not the creator
            // (creator already has the group added locally via createGroup action)
            const isMember = group.members.map((m: string) => m.toLowerCase()).includes(myAddr)
            const isCreator = group.creator.toLowerCase() === myAddr
            if (isMember && !isCreator) {
              get().refreshChats()
            }
          }
        )
        // Profile updates — refresh cache when any user updates their profile
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles' },
          async (payload) => {
            const { parseFriendPermission } = await import('@/lib/profile')
            const row = payload.new as { wallet_address: string; nickname: string | null; avatar_url: string | null; friend_permission?: string | null }
            const addr = row.wallet_address.toLowerCase()
            const profileData = {
              nickname: row.nickname,
              avatarUrl: row.avatar_url,
              friendPermission: parseFriendPermission(row.friend_permission),
            }
            // Update own profile if it's ours
            if (get().walletAddress?.toLowerCase() === addr) {
              set({ myProfile: profileData })
            }
            // Update cache
            set((s) => ({
              profileCache: { ...s.profileCache, [addr]: profileData },
            }))
          }
        )
        // Group management Realtime events
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'groups' },
          (payload) => {
            const updatedGroup = payload.new as GroupRow & { admins?: string[]; announcement?: string; announcement_at?: string; announcement_by?: string; join_mode?: string; invite_approval?: boolean; mute_all?: boolean; creator?: string }
            const currentState = get()
            const myAddr = currentState.walletAddress?.toLowerCase() || ''
            const isMember = updatedGroup.members?.map((m: string) => m.toLowerCase()).includes(myAddr)
            if (!isMember) {
              // I was removed from this group
              set((s) => {
                const chats = s.chats.filter(c => c.id !== updatedGroup.id)
                return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
              })
              return
            }
            // Update chat object and activeGroupDetail with new group data
            set((s) => {
              const gid = updatedGroup.id
              const existingDetail = s.activeGroupDetail[gid]
              const updatedDetailData = {
                ...existingDetail,
                name: updatedGroup.name,
                members: updatedGroup.members || existingDetail?.members || [],
                admins: updatedGroup.admins || existingDetail?.admins || [],
                creator: updatedGroup.creator ?? existingDetail?.creator ?? '',
                announcement: updatedGroup.announcement ?? existingDetail?.announcement ?? null,
                announcement_at: updatedGroup.announcement_at ?? existingDetail?.announcement_at ?? null,
                announcement_by: updatedGroup.announcement_by ?? existingDetail?.announcement_by ?? null,
                join_mode: (updatedGroup.join_mode as any) ?? existingDetail?.join_mode ?? 'free',
                invite_approval: updatedGroup.invite_approval ?? existingDetail?.invite_approval ?? false,
                mute_all: updatedGroup.mute_all ?? existingDetail?.mute_all ?? false,
                avatar_url: (updatedGroup as any).avatar_url ?? existingDetail?.avatar_url ?? null,
              }
              const updatedActiveGroupDetail = {
                ...s.activeGroupDetail,
                [gid]: existingDetail
                  ? updatedDetailData
                  : { ...updatedDetailData, id: gid } as any,
              }
              return {
                activeGroupDetail: updatedActiveGroupDetail,
                chats: s.chats.map(c => {
                  if (c.id !== gid) return c
                  return { ...c, name: updatedGroup.name, members: updatedGroup.members?.length, groupAvatarUrl: (updatedGroup as any).avatar_url || c.groupAvatarUrl }
                }),
              }
            })
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'groups' },
          (payload) => {
            const oldGroup = payload.old as { id?: string }
            if (!oldGroup.id) return
            set((s) => {
              const chats = s.chats.filter(c => c.id !== oldGroup.id)
              const { [oldGroup.id!]: _, ...restGroupDetail } = s.activeGroupDetail
              return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0), activeGroupDetail: restGroupDetail }
            })
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_join_requests' },
          (payload) => {
            const req = payload.new as GroupJoinRequestRow
            const currentState = get()
            const myAddr = currentState.walletAddress?.toLowerCase() || ''
            // Check if I'm admin/owner of this group
            const chat = currentState.chats.find(c => c.id === req.group_id)
            if (!chat || chat.type !== 'group') return
            set((s) => ({
              pendingRequestCounts: {
                ...s.pendingRequestCounts,
                [req.group_id]: (s.pendingRequestCounts[req.group_id] || 0) + 1,
              },
            }))
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'group_mutes' },
          (payload) => {
            const mute = payload.new as GroupMuteRow
            const myAddr = get().walletAddress?.toLowerCase() || ''
            if (mute.wallet_address.toLowerCase() === myAddr) {
              set((s) => ({
                myMuteStatus: { ...s.myMuteStatus, [mute.group_id]: mute },
              }))
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'group_mutes' },
          (payload) => {
            const oldMute = payload.old as { group_id?: string; wallet_address?: string }
            const myAddr = get().walletAddress?.toLowerCase() || ''
            if (oldMute.wallet_address?.toLowerCase() === myAddr && oldMute.group_id) {
              set((s) => ({
                myMuteStatus: { ...s.myMuteStatus, [oldMute.group_id!]: null },
              }))
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'group_mutes' },
          (payload) => {
            const mute = payload.new as GroupMuteRow
            const myAddr = get().walletAddress?.toLowerCase() || ''
            if (mute.wallet_address.toLowerCase() === myAddr) {
              set((s) => ({
                myMuteStatus: { ...s.myMuteStatus, [mute.group_id]: mute },
              }))
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'group_join_requests' },
          async (payload) => {
            const req = payload.new as GroupJoinRequestRow
            const currentState = get()
            const myAddr = currentState.walletAddress?.toLowerCase() || ''
            if (req.requester.toLowerCase() === myAddr) {
              const { default: toast } = await import('react-hot-toast')
              const { t } = await import('@/lib/i18n')
              const locale = get().locale
              if (req.status === 'approved') {
                toast.success(t('group.joinSuccess', locale))
                get().refreshChats()
              } else if (req.status === 'rejected') {
                toast.error(t('group.requestRejected', locale))
              }
            }
            if (req.invited_by?.toLowerCase() === myAddr && req.status === 'rejected') {
              const { default: toast } = await import('react-hot-toast')
              const { t } = await import('@/lib/i18n')
              const locale = get().locale
              const name = get().getDisplayName(req.requester)
              toast.error(t('group.inviteRejectedNotify', locale).replace('{name}', name))
            }
            // Decrement pending badge for other admins when a request is approved/rejected via Realtime
            if (req.status === 'approved' || req.status === 'rejected') {
              set((s) => ({
                pendingRequestCounts: {
                  ...s.pendingRequestCounts,
                  [req.group_id]: Math.max(0, (s.pendingRequestCounts[req.group_id] || 0) - 1),
                },
              }))
            }
          }
        )
        .subscribe()

      // Second stale-check: if walletAddress changed during subscribe(), discard channel
      if (get().walletAddress?.toLowerCase() !== me) {
        supabase.removeChannel(channel)
        return
      }
      set({ chatChannel: channel })
    } catch (error) {
      console.error('[Chat] initChat FAILED', error)
    } finally {
      // Only reset isConnectingChat if we are still the active wallet
      // This prevents stale initChat from corrupting a newer initChat's in-progress state
      if (get().walletAddress?.toLowerCase() === me) {
        set({ isConnectingChat: false })
      }
    }
  },

  destroyChat: () => {
    const state = get()
    if (state.chatChannel) {
      supabase.removeChannel(state.chatChannel)
    }
    set({
      chatChannel: null,
      chatRequests: [],
      chatReady: false,
      isConnectingChat: false,
      walletAddress: null,
      chats: [],
      unreadChatCount: 0,
      myProfile: null,
      profileCache: {},
      groupJoinedAtMap: {},
      myGroupSettings: {},
      pendingRequestCounts: {},
      myMuteStatus: {},
      activeGroupDetail: {},
    })
  },

  refreshChats: async () => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()
    try {
      const { fetchContacts, fetchGroups, fetchLastMessages } = await import('@/lib/chat')
      const [contacts, groups] = await Promise.all([
        fetchContacts(me),
        fetchGroups(me),
      ])

      const personalChatIds = contacts.map(c => {
        const peerAddr = c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
        return getChatId(me, peerAddr)
      })
      const groupChatIds = groups.map(g => g.id)
      const allChatIds = [...personalChatIds, ...groupChatIds]
      const lastMsgs = allChatIds.length > 0 ? await fetchLastMessages(allChatIds) : {}

      // Fetch group member settings for current user
      let myGroupMemberRows: GroupMemberRow[] = []
      if (groups.length > 0) {
        const { data } = await supabase
          .from('group_members')
          .select('*')
          .eq('wallet_address', me)
          .in('group_id', groupChatIds)
        myGroupMemberRows = (data || []) as GroupMemberRow[]
      }
      const newGroupSettings: Record<string, GroupMemberRow> = {}
      const newJoinedAtMap: Record<string, string> = {}
      for (const row of myGroupMemberRows) {
        newGroupSettings[row.group_id] = row
        newJoinedAtMap[row.group_id] = row.joined_at
      }
      for (const gId of groupChatIds) {
        if (!newJoinedAtMap[gId]) {
          const g = groups.find(gr => gr.id === gId)
          if (g) newJoinedAtMap[gId] = g.created_at
        }
      }

      // Load profiles for any new contacts not yet cached
      const peerAddresses = contacts.map(c =>
        c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
      )
      const uncachedAddresses = peerAddresses.filter(a => !get().profileCache[a.toLowerCase()])
      if (uncachedAddresses.length > 0) {
        get().loadProfiles(uncachedAddresses)
      }

      set((s) => {
        const personalChats = contacts.map(c => {
          const peerAddr = c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
          const chatId = getChatId(me, peerAddr)
          const existing = s.chats.find(ch => ch.id === chatId)
          const lastMsg = lastMsgs[chatId] || null
          return {
            id: chatId,
            name: `${peerAddr.slice(0, 6)}...${peerAddr.slice(-4)}`,
            avatarColor: addressToColor(peerAddr),
            lastMessage: lastMsg?.content || existing?.lastMessage || '',
            timestamp: lastMsg
              ? new Date(lastMsg.created_at).getTime()
              : (existing?.timestamp || new Date(c.created_at).getTime()),
            unread: existing?.unread || 0,
            online: false,
            typing: false,
            type: 'personal' as const,
            walletAddress: peerAddr,
            messages: existing?.messages || [],
            pinned: existing?.pinned,
          }
        })

        const groupChats = groups.map(g => {
          const existing = s.chats.find(ch => ch.id === g.id)
          const lastMsg = lastMsgs[g.id] || null
          return {
            id: g.id,
            name: g.name,
            avatarColor: addressToColor(g.id),
            lastMessage: lastMsg?.content || existing?.lastMessage || '',
            timestamp: lastMsg
              ? new Date(lastMsg.created_at).getTime()
              : (existing?.timestamp || new Date(g.created_at).getTime()),
            unread: existing?.unread || 0,
            online: false,
            typing: false,
            type: 'group' as const,
            members: g.members.length,
            messages: existing?.messages || [],
            pinned: newGroupSettings[g.id]?.pinned ?? existing?.pinned ?? false,
          }
        })

        const chats = [...personalChats, ...groupChats].sort((a, b) => b.timestamp - a.timestamp)
        return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0), myGroupSettings: { ...s.myGroupSettings, ...newGroupSettings }, groupJoinedAtMap: { ...s.groupJoinedAtMap, ...newJoinedAtMap } }
      })
    } catch (error) {
      console.error('refreshChats failed:', error)
    }
  },

  refreshChatRequests: async () => {
    const state = get()
    if (!state.walletAddress) return
    try {
      const { fetchPendingRequests } = await import('@/lib/chat')
      const pendingRequests = await fetchPendingRequests(state.walletAddress)
      const chatRequests: ChatRequest[] = pendingRequests.map(c => ({
        id: c.id,
        fromAddress: c.wallet_a,
        message: c.request_msg || '',
        timestamp: new Date(c.created_at).getTime(),
      }))
      set({ chatRequests })
    } catch (error) {
      console.error('refreshChatRequests failed:', error)
    }
  },

  acceptRequest: async (fromAddress) => {
    const state = get()
    if (!state.walletAddress) return
    try {
      const { acceptFriendRequest } = await import('@/lib/chat')
      await acceptFriendRequest(state.walletAddress, fromAddress)
      set((s) => ({
        chatRequests: s.chatRequests.filter(
          (r) => r.fromAddress.toLowerCase() !== fromAddress.toLowerCase()
        ),
      }))
      await get().refreshChats()
      const { default: toast } = await import('react-hot-toast')
      const locale = get().locale
      toast.success(locale === 'zh' ? '已接受好友请求，快去打招呼吧！' : 'Friend request accepted! Say hi!')
    } catch (error) {
      console.error('acceptRequest failed:', error)
      const { default: toast } = await import('react-hot-toast')
      toast.error(get().locale === 'zh' ? '操作失败，请重试' : 'Failed, please retry')
    }
  },

  rejectRequest: async (fromAddress) => {
    const state = get()
    if (!state.walletAddress) return
    try {
      const { rejectFriendRequest } = await import('@/lib/chat')
      await rejectFriendRequest(state.walletAddress, fromAddress)
      set((s) => ({
        chatRequests: s.chatRequests.filter(
          (r) => r.fromAddress.toLowerCase() !== fromAddress.toLowerCase()
        ),
      }))
      const { default: toast } = await import('react-hot-toast')
      toast.success(get().locale === 'zh' ? '已拒绝请求' : 'Request rejected')
    } catch (error) {
      console.error('rejectRequest failed:', error)
    }
  },

  sendFriendRequest: async (address, message) => {
    const state = get()
    if (!state.walletAddress) throw new Error('No wallet connected')
    try {
      const { sendFriendRequest: supabaseSend } = await import('@/lib/chat')
      const result = await supabaseSend(state.walletAddress, address, message)
      if (result.mode === 'accepted') {
        // allow_all: friend added directly, refresh chat list
        await get().refreshChats()
      }
      return result
    } catch (error) {
      console.error('sendFriendRequest failed:', error)
      throw error
    }
  },

  sendPushMessage: async (address, content) => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()
    const chatId = getChatId(me, address.toLowerCase())

    // Validate that the chat exists for the current wallet session
    if (!state.chats.some(c => c.id === chatId)) {
      console.warn('[sendPushMessage] chatId not found in current chats — wallet may have changed. Aborting.')
      throw new Error('Chat session mismatch: please refresh and try again')
    }

    // Optimistic update
    const optimisticId = `opt-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      sender: 'me',
      content,
      timestamp: Date.now(),
      status: 'sent',
    }
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, lastMessage: content, timestamp: Date.now(), messages: [...c.messages, optimisticMsg] }
          : c
      ),
    }))

    try {
      const { sendMessage: supabaseSend } = await import('@/lib/chat')
      await supabaseSend(chatId, me, content)
    } catch (error) {
      console.error('sendPushMessage failed:', error)
      // Rollback optimistic message
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) }
            : c
        ),
      }))
      throw error
    }
  },

  sendGroupPushMessage: async (chatId, content) => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()

    // Check mute status before sending
    const myMute = state.myMuteStatus[chatId]
    if (myMute) {
      const isExpired = myMute.mute_until && new Date(myMute.mute_until).getTime() < Date.now()
      if (!isExpired) {
        throw new MutedError(myMute.mute_until)
      }
    }
    // Check group-wide mute (only allow owner/admin)
    const groupChat = state.chats.find(c => c.id === chatId)
    if (groupChat && groupChat.type === 'group') {
      const gDetail = state.activeGroupDetail[chatId]
      if (gDetail?.mute_all) {
        const isOwner = gDetail.creator === me
        const isAdmin = (gDetail.admins || []).map((a: string) => a.toLowerCase()).includes(me)
        if (!isOwner && !isAdmin) {
          throw new MutedError(null)
        }
      }
    }

    // Validate that the group chat exists for the current wallet session
    if (!state.chats.some(c => c.id === chatId)) {
      console.warn('[sendGroupPushMessage] chatId not found in current chats — wallet may have changed. Aborting.')
      throw new Error('Chat session mismatch: please refresh and try again')
    }

    // Optimistic update
    const optimisticId = `opt-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      sender: 'me',
      content,
      timestamp: Date.now(),
      status: 'sent',
    }
    set((s) => ({
      chats: s.chats.map((c) =>
        c.id === chatId
          ? { ...c, lastMessage: content, timestamp: Date.now(), messages: [...c.messages, optimisticMsg] }
          : c
      ),
    }))

    try {
      const { sendMessage: supabaseSend } = await import('@/lib/chat')
      await supabaseSend(chatId, me, content)
    } catch (error) {
      console.error('sendGroupPushMessage failed:', error)
      // Rollback optimistic message
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === chatId
            ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticId) }
            : c
        ),
      }))
      throw error
    }
  },

  sendMediaMessage: async (chatId, file, msgType, duration) => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()

    if (!state.chats.some(c => c.id === chatId)) {
      throw new Error('Chat session mismatch')
    }

    const summary = getMessageSummary(msgType, undefined, file.name)
    const optimisticId = `opt-${Date.now()}`
    const optimisticMsg: Message = {
      id: optimisticId,
      sender: 'me',
      content: summary,
      timestamp: Date.now(),
      status: 'sent',
      msgType,
      fileName: file.name,
      fileSize: file.size,
      duration,
      uploadProgress: 0,
    }
    set(s => ({
      chats: s.chats.map(c =>
        c.id === chatId
          ? { ...c, lastMessage: summary, timestamp: Date.now(), messages: [...c.messages, optimisticMsg] }
          : c
      ),
    }))

    try {
      const { uploadChatFile } = await import('@/lib/chat-media')
      const result = await uploadChatFile(chatId, file, (pct) => {
        set(s => ({
          chats: s.chats.map(c =>
            c.id === chatId
              ? { ...c, messages: c.messages.map(m => m.id === optimisticId ? { ...m, uploadProgress: pct } : m) }
              : c
          ),
        }))
      })

      // Update optimistic message with URL before DB write
      set(s => ({
        chats: s.chats.map(c =>
          c.id === chatId
            ? { ...c, messages: c.messages.map(m => m.id === optimisticId ? { ...m, fileUrl: result.url, uploadProgress: 100 } : m) }
            : c
        ),
      }))

      const { sendMessage: supabaseSend } = await import('@/lib/chat')
      await supabaseSend(chatId, me, summary, msgType, {
        file_url: result.url,
        file_name: result.fileName,
        file_size: result.fileSize,
        duration: duration ?? null,
      })
    } catch (error) {
      set(s => ({
        chats: s.chats.map(c =>
          c.id === chatId
            ? { ...c, messages: c.messages.map(m => m.id === optimisticId ? { ...m, status: 'failed' as const, uploadProgress: undefined } : m) }
            : c
        ),
      }))
      throw error
    }
  },

  retryMediaMessage: async (chatId, messageId, file, msgType, duration) => {
    const state = get()
    if (!state.walletAddress) return
    // Remove the failed message first
    set(s => ({
      chats: s.chats.map(c =>
        c.id === chatId
          ? { ...c, messages: c.messages.filter(m => m.id !== messageId) }
          : c
      ),
    }))
    // Re-send
    await get().sendMediaMessage(chatId, file, msgType, duration)
  },

  searchUserByAddress: async (address) => {
    // With Supabase, any valid EVM address is searchable — no network call needed
    const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
    if (!ADDRESS_REGEX.test(address)) return null
    return { address: address.toLowerCase() }
  },

  searchUserByNickname: async (keyword) => {
    const state = get()
    if (!state.walletAddress) return []
    const { searchByNickname } = await import('@/lib/profile')
    return searchByNickname(keyword, state.walletAddress)
  },

  loadChatHistory: async (chatId) => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()
    try {
      const { fetchMessages } = await import('@/lib/chat')
      const chat = state.chats.find(c => c.id === chatId)
      const sinceTimestamp = chat?.type === 'group' ? state.groupJoinedAtMap[chatId] : undefined
      const rawMsgs = await fetchMessages(chatId, 50, sinceTimestamp)
      const messages: Message[] = rawMsgs.map(msg => ({
        id: `db-${msg.id}`,
        sender: msg.sender.toLowerCase() === me ? 'me' as const : msg.sender,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        status: 'read' as const,
        msgType: (msg.msg_type === 'text' || msg.msg_type === 'system') ? undefined : msg.msg_type as Message['msgType'],
        fileUrl: msg.file_url || undefined,
        fileName: msg.file_name || undefined,
        fileSize: msg.file_size || undefined,
        duration: msg.duration || undefined,
        thumbnailUrl: msg.thumbnail_url || undefined,
      }))
      // Filter out locally deleted messages
      const { filterDeletedMessages } = require('@/lib/message-delete')
      const filtered = filterDeletedMessages(me, chatId, messages)
      const lastVisibleMsg = filtered[filtered.length - 1]
      set((s) => ({
        chats: s.chats.map((c) => c.id === chatId ? {
          ...c,
          messages: filtered,
          ...(lastVisibleMsg ? { lastMessage: getMessageSummary(lastVisibleMsg.msgType, lastVisibleMsg.content, lastVisibleMsg.fileName) } : {}),
        } : c),
      }))
    } catch (error) {
      console.error('loadChatHistory failed:', error)
    }
  },

  createGroup: async (groupName, memberAddresses) => {
    const state = get()
    if (!state.walletAddress) {
      const { default: toast } = await import('react-hot-toast')
      const { t } = await import('@/lib/i18n')
      toast.error(t('chat.pushNotInitialized', state.locale))
      return
    }
    if (memberAddresses.length === 0) {
      const { default: toast } = await import('react-hot-toast')
      const { t } = await import('@/lib/i18n')
      toast.error(t('chat.noFriendsForGroup', state.locale))
      return
    }
    try {
      const { createGroup: supabaseCreateGroup } = await import('@/lib/chat')
      const { t } = await import('@/lib/i18n')
      const locale = get().locale
      const finalName = groupName.trim() ||
        (locale === 'zh' ? `群聊（${memberAddresses.length + 1}人）` : `Group (${memberAddresses.length + 1})`)
      const group = await supabaseCreateGroup(state.walletAddress, finalName, memberAddresses)
      const newChat: Chat = {
        id: group.id,
        name: finalName,
        avatarColor: addressToColor(group.id),
        lastMessage: locale === 'zh' ? '群聊已创建' : 'Group created',
        timestamp: Date.now(),
        unread: 0,
        online: false,
        typing: false,
        type: 'group',
        members: group.members.length,
        pinned: false,
        messages: [],
        walletAddress: undefined,
      }
      set((s) => ({
        chats: [newChat, ...s.chats],
      }))
      const { default: toast } = await import('react-hot-toast')
      toast.success(t('chat.groupCreated', get().locale))
    } catch (error) {
      console.error('[createGroup] failed:', error)
      const { default: toast } = await import('react-hot-toast')
      const { t } = await import('@/lib/i18n')
      toast.error(t('chat.groupCreateFailed', get().locale))
      throw error
    }
  },

  // ======== Group Management Actions ========

  getGroupDisplayName: (groupId, address) => {
    const state = get()
    const addr = address.toLowerCase()
    const settings = state.myGroupSettings[groupId]
    // For other members, we need to check member list — but we only cache our own settings
    // For MVP, check profileCache for group nickname (stored in group_members for that user)
    // Since we only have our own settings cached, for other members fall through to profile
    if (state.walletAddress?.toLowerCase() === addr && settings?.group_nickname) {
      return settings.group_nickname
    }
    // Fallback to profile display name
    return state.getDisplayName(address)
  },

  loadGroupMemberSettings: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const { fetchMyGroupSettings } = await import('@/lib/group-management')
    const settings = await fetchMyGroupSettings(groupId, state.walletAddress)
    if (settings) {
      set((s) => ({
        myGroupSettings: { ...s.myGroupSettings, [groupId]: settings },
        groupJoinedAtMap: { ...s.groupJoinedAtMap, [groupId]: settings.joined_at },
      }))
    }
  },

  updateGroupNickname: async (groupId, nickname) => {
    const state = get()
    if (!state.walletAddress) return
    const { updateMyGroupSettings } = await import('@/lib/group-management')
    await updateMyGroupSettings(groupId, state.walletAddress, { group_nickname: nickname || null })
    set((s) => ({
      myGroupSettings: {
        ...s.myGroupSettings,
        [groupId]: { ...s.myGroupSettings[groupId], group_nickname: nickname || null } as GroupMemberRow,
      },
    }))
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.nicknameSaved', get().locale))
  },

  toggleGroupPin: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const current = state.myGroupSettings[groupId]?.pinned ?? false
    const { updateMyGroupSettings } = await import('@/lib/group-management')
    await updateMyGroupSettings(groupId, state.walletAddress, { pinned: !current })
    set((s) => ({
      myGroupSettings: {
        ...s.myGroupSettings,
        [groupId]: { ...s.myGroupSettings[groupId], pinned: !current } as GroupMemberRow,
      },
      chats: s.chats.map(c => c.id === groupId ? { ...c, pinned: !current } : c),
    }))
  },

  toggleGroupDND: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const current = state.myGroupSettings[groupId]?.muted_notifications ?? false
    const { updateMyGroupSettings } = await import('@/lib/group-management')
    await updateMyGroupSettings(groupId, state.walletAddress, { muted_notifications: !current })
    set((s) => ({
      myGroupSettings: {
        ...s.myGroupSettings,
        [groupId]: { ...s.myGroupSettings[groupId], muted_notifications: !current } as GroupMemberRow,
      },
    }))
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t(!current ? 'group.dndEnabled' : 'group.dndDisabled', get().locale))
  },

  markAnnouncementRead: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const now = new Date().toISOString()
    const { updateMyGroupSettings } = await import('@/lib/group-management')
    await updateMyGroupSettings(groupId, state.walletAddress, { last_read_announcement_at: now })
    set((s) => ({
      myGroupSettings: {
        ...s.myGroupSettings,
        [groupId]: { ...s.myGroupSettings[groupId], last_read_announcement_at: now } as GroupMemberRow,
      },
    }))
  },

  openGroupManagement: async (groupId) => {
    try {
      const { fetchGroupDetail } = await import('@/lib/group-management')
      const detail = await fetchGroupDetail(groupId)
      set(s => ({ activeGroupDetail: { ...s.activeGroupDetail, [groupId]: detail } }))
      return detail
    } catch (error) {
      console.error('[openGroupManagement] failed:', error)
      return null
    }
  },

  setAdmin: async (groupId, wallet) => {
    const state = get()
    if (!state.walletAddress) return
    const { addAdmin } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    await addAdmin(groupId, wallet)
    const name = state.getDisplayName(wallet)
    await supabaseSend(groupId, 'system', `${name} 已被设为管理员`, 'system')
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.setAdminSuccess', get().locale))
    get().refreshGroupDetail(groupId).catch(() => {})
  },

  unsetAdmin: async (groupId, wallet) => {
    const state = get()
    if (!state.walletAddress) return
    const { removeAdmin } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    await removeAdmin(groupId, wallet)
    const name = state.getDisplayName(wallet)
    await supabaseSend(groupId, 'system', `${name} 被取消了管理员`, 'system')
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.removeAdminSuccess', get().locale))
    get().refreshGroupDetail(groupId).catch(() => {})
  },

  transferGroupOwnership: async (groupId, newOwner) => {
    const state = get()
    if (!state.walletAddress) return
    const { fetchGroupDetail, transferOwnership } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    const detail = await fetchGroupDetail(groupId)
    await transferOwnership(groupId, newOwner, detail.admins)
    const name = state.getDisplayName(newOwner)
    await supabaseSend(groupId, 'system', `群主已转让给 ${name}`, 'system')
    await get().refreshChats()
    get().refreshGroupDetail(groupId).catch(() => {})
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.transferSuccess', get().locale))
  },

  kickMember: async (groupId, wallet) => {
    const state = get()
    if (!state.walletAddress) return
    const { removeGroupMember } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    const name = state.getDisplayName(wallet)
    await removeGroupMember(groupId, wallet)
    await supabaseSend(groupId, 'system', `${name} 被移出了群聊`, 'system')
    get().refreshGroupDetail(groupId).catch(() => {})
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.memberRemoved', get().locale))
  },

  leaveGroupAction: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const { leaveGroup } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    const name = state.getDisplayName(state.walletAddress)
    await supabaseSend(groupId, 'system', `${name} 退出了群聊`, 'system')
    await leaveGroup(groupId, state.walletAddress)
    set((s) => {
      const chats = s.chats.filter(c => c.id !== groupId)
      const { [groupId]: _, ...restGroupDetail } = s.activeGroupDetail
      return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0), activeGroupDetail: restGroupDetail }
    })
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.leaveSuccess', get().locale))
  },

  dissolveGroupAction: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const { dissolveGroup } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    // Send system message first (best-effort)
    try { await supabaseSend(groupId, 'system', '群聊已解散', 'system') } catch { /* non-blocking */ }
    // Actually dissolve the group — only update local state on success
    await dissolveGroup(groupId)
    set((s) => {
      const chats = s.chats.filter(c => c.id !== groupId)
      const { [groupId]: _, ...restGroupDetail } = s.activeGroupDetail
      return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0), activeGroupDetail: restGroupDetail }
    })
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.dissolveSuccess', get().locale))
  },

  muteMember: async (groupId, wallet, duration) => {
    const state = get()
    if (!state.walletAddress) return
    const { muteGroupMember } = await import('@/lib/group-management')
    await muteGroupMember(groupId, wallet, duration, state.walletAddress)
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.muteSuccess', get().locale))
  },

  unmuteMember: async (groupId, wallet) => {
    const { unmuteGroupMember } = await import('@/lib/group-management')
    await unmuteGroupMember(groupId, wallet)
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.unmuteSuccess', get().locale))
  },

  toggleMuteAll: async (groupId) => {
    const state = get()
    if (!state.walletAddress) return
    const { fetchGroupDetail, updateGroupSettings } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    const detail = state.activeGroupDetail[groupId] || await fetchGroupDetail(groupId)
    const newVal = !detail.mute_all
    await updateGroupSettings(groupId, { mute_all: newVal })
    get().patchActiveGroupDetail(groupId, { mute_all: newVal })
    await supabaseSend(groupId, 'system', newVal ? '管理员开启了全群禁言' : '管理员关闭了全群禁言', 'system')
  },

  updateGroupNameAction: async (groupId, name) => {
    const state = get()
    if (!state.walletAddress) return
    const { updateGroupName } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    await updateGroupName(groupId, name)
    await supabaseSend(groupId, 'system', `群名已修改为「${name}」`, 'system')
    get().patchActiveGroupDetail(groupId, { name })
    set((s) => ({
      chats: s.chats.map(c => c.id === groupId ? { ...c, name } : c),
    }))
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.nameUpdated', get().locale))
  },

  setAnnouncementAction: async (groupId, text) => {
    const state = get()
    if (!state.walletAddress) return
    const { setGroupAnnouncement } = await import('@/lib/group-management')
    const { sendMessage: supabaseSend } = await import('@/lib/chat')
    await setGroupAnnouncement(groupId, text, state.walletAddress)
    const now = new Date().toISOString()
    get().patchActiveGroupDetail(groupId, { announcement: text, announcement_at: now, announcement_by: state.walletAddress.toLowerCase() })
    const name = state.getDisplayName(state.walletAddress)
    await supabaseSend(groupId, 'system', `${name} 更新了群公告`, 'system')
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(t('group.announcementUpdated', get().locale))
  },

  updateJoinMode: async (groupId, mode) => {
    const { updateGroupSettings } = await import('@/lib/group-management')
    await updateGroupSettings(groupId, { join_mode: mode })
    get().patchActiveGroupDetail(groupId, { join_mode: mode })
  },

  toggleInviteApproval: async (groupId) => {
    const { fetchGroupDetail, updateGroupSettings, fetchJoinRequests, handleJoinRequest } = await import('@/lib/group-management')
    const state = get()
    if (!state.walletAddress) return
    const detail = state.activeGroupDetail[groupId] || await fetchGroupDetail(groupId)
    const newVal = !detail.invite_approval
    await updateGroupSettings(groupId, { invite_approval: newVal })
    get().patchActiveGroupDetail(groupId, { invite_approval: newVal })
    // When switching from approval→no approval, auto-approve pending invite requests
    if (!newVal) {
      const requests = await fetchJoinRequests(groupId)
      const inviteRequests = requests.filter(r => r.request_type === 'invite')
      for (const req of inviteRequests) {
        await handleJoinRequest(req.id, 'approved', state.walletAddress)
      }
      if (inviteRequests.length > 0) {
        set(s => ({ pendingRequestCounts: { ...s.pendingRequestCounts, [groupId]: 0 } }))
      }
    }
  },

  createGroupInvite: async (groupId, expiresInDays) => {
    const state = get()
    if (!state.walletAddress) throw new Error('No wallet')
    const { createInviteLink } = await import('@/lib/group-management')
    return await createInviteLink(groupId, state.walletAddress, expiresInDays)
  },

  revokeGroupInvite: async (inviteId) => {
    const { revokeInviteLink } = await import('@/lib/group-management')
    await revokeInviteLink(inviteId)
  },

  joinGroupViaToken: async (token) => {
    const state = get()
    if (!state.walletAddress) throw new Error('No wallet')
    const { joinViaInviteToken } = await import('@/lib/group-management')
    const result = await joinViaInviteToken(token, state.walletAddress)
    if (result.status === 'joined') {
      await get().refreshChats()
    }
    return result
  },

  inviteFriendsToGroupAction: async (groupId, wallets) => {
    const state = get()
    if (!state.walletAddress) return
    const { fetchGroupDetail, getGroupRole, inviteFriendsToGroup } = await import('@/lib/group-management')
    const detail = await fetchGroupDetail(groupId)
    const role = getGroupRole(detail, state.walletAddress)
    const needApproval = role === 'member' ? detail.invite_approval : false
    await inviteFriendsToGroup(groupId, wallets, state.walletAddress, needApproval)
    if (!needApproval) {
      await get().refreshChats()
      get().refreshGroupDetail(groupId).catch(() => {})
    }
    const { default: toast } = await import('react-hot-toast')
    const { t } = await import('@/lib/i18n')
    toast.success(needApproval ? t('group.invitePending', get().locale) : t('group.joinSuccess', get().locale))
  },

  fetchGroupJoinRequests: async (groupId) => {
    const { fetchJoinRequests } = await import('@/lib/group-management')
    return await fetchJoinRequests(groupId)
  },

  handleJoinRequestAction: async (requestId, action, groupId?: string) => {
    const state = get()
    if (!state.walletAddress) return
    const { handleJoinRequest } = await import('@/lib/group-management')
    await handleJoinRequest(requestId, action, state.walletAddress)
    if (action === 'approved') {
      await get().refreshChats()
    }
    // Decrement pending request badge count
    if (groupId) {
      set((s) => ({
        pendingRequestCounts: {
          ...s.pendingRequestCounts,
          [groupId]: Math.max(0, (s.pendingRequestCounts[groupId] || 0) - 1),
        },
      }))
    }
  },

  refreshGroupDetail: async (groupId) => {
    const { fetchGroupDetail } = await import('@/lib/group-management')
    const detail = await fetchGroupDetail(groupId)
    set((s) => ({
      activeGroupDetail: { ...s.activeGroupDetail, [groupId]: detail },
      chats: s.chats.map(c => {
        if (c.id !== groupId) return c
        return { ...c, name: detail.name, members: detail.members.length, groupAvatarUrl: detail.avatar_url || undefined }
      }),
    }))
  },

  patchActiveGroupDetail: (groupId, patch) => {
    set(s => {
      const existing = s.activeGroupDetail[groupId]
      if (!existing) return s
      return { activeGroupDetail: { ...s.activeGroupDetail, [groupId]: { ...existing, ...patch } } }
    })
  },

  updateGroupAvatarAction: async (groupId, file) => {
    const { uploadGroupAvatar, updateGroupAvatar } = await import('@/lib/group-management')
    const avatarUrl = await uploadGroupAvatar(groupId, file)
    await updateGroupAvatar(groupId, avatarUrl)
    set(s => ({
      activeGroupDetail: {
        ...s.activeGroupDetail,
        [groupId]: s.activeGroupDetail[groupId] ? { ...s.activeGroupDetail[groupId], avatar_url: avatarUrl } : s.activeGroupDetail[groupId],
      },
      chats: s.chats.map(c => c.id === groupId ? { ...c, groupAvatarUrl: avatarUrl } : c),
    }))
  },

  // ======== Profile Actions ========

  loadMyProfile: async (walletAddress) => {
    try {
      const { fetchProfile } = await import('@/lib/profile')
      const profile = await fetchProfile(walletAddress)
      const { FRIEND_PERMISSION_DEFAULT } = await import('@/lib/profile')
      set({ myProfile: profile || { nickname: null, avatarUrl: null, friendPermission: FRIEND_PERMISSION_DEFAULT } })
    } catch (error) {
      console.error('[Profile] loadMyProfile failed:', error)
      const { FRIEND_PERMISSION_DEFAULT } = await import('@/lib/profile')
      set({ myProfile: { nickname: null, avatarUrl: null, friendPermission: FRIEND_PERMISSION_DEFAULT } })
    }
  },

  updateNickname: async (nickname) => {
    const state = get()
    if (!state.walletAddress) return
    const { upsertProfile, FRIEND_PERMISSION_DEFAULT } = await import('@/lib/profile')
    const oldNickname = state.myProfile?.nickname ?? null
    const newNickname = nickname || null
    // Optimistic update
    set({
      myProfile: {
        nickname: newNickname,
        avatarUrl: state.myProfile?.avatarUrl ?? null,
        friendPermission: state.myProfile?.friendPermission ?? FRIEND_PERMISSION_DEFAULT,
      },
    })
    try {
      await upsertProfile({
        wallet_address: state.walletAddress,
        nickname: newNickname,
      })
    } catch (error) {
      // Rollback
      set({
        myProfile: {
          nickname: oldNickname,
          avatarUrl: state.myProfile?.avatarUrl ?? null,
          friendPermission: state.myProfile?.friendPermission ?? FRIEND_PERMISSION_DEFAULT,
        },
      })
      console.error('[Profile] updateNickname failed:', error)
      throw error
    }
  },

  updateAvatar: async (file) => {
    const state = get()
    if (!state.walletAddress) return
    const { uploadAvatar, upsertProfile, FRIEND_PERMISSION_DEFAULT } = await import('@/lib/profile')
    const oldAvatarUrl = state.myProfile?.avatarUrl ?? null
    try {
      const avatarUrl = await uploadAvatar(state.walletAddress, file)
      // Optimistic update after upload succeeds
      set({
        myProfile: {
          nickname: state.myProfile?.nickname ?? null,
          avatarUrl,
          friendPermission: state.myProfile?.friendPermission ?? FRIEND_PERMISSION_DEFAULT,
        },
      })
      try {
        await upsertProfile({
          wallet_address: state.walletAddress,
          avatar_url: avatarUrl,
        })
      } catch (upsertError) {
        // Rollback avatar URL on upsert failure
        set({
          myProfile: {
            nickname: state.myProfile?.nickname ?? null,
            avatarUrl: oldAvatarUrl,
            friendPermission: state.myProfile?.friendPermission ?? FRIEND_PERMISSION_DEFAULT,
          },
        })
        throw upsertError
      }
    } catch (error) {
      console.error('[Profile] updateAvatar failed:', error)
      throw error
    }
  },

  updateFriendPermission: async (permission) => {
    const state = get()
    if (!state.walletAddress) return
    const oldPermission = state.myProfile?.friendPermission
    // Optimistic update
    const { FRIEND_PERMISSION_DEFAULT } = await import('@/lib/profile')
    set({
      myProfile: {
        nickname: state.myProfile?.nickname ?? null,
        avatarUrl: state.myProfile?.avatarUrl ?? null,
        friendPermission: permission,
      },
    })
    try {
      const { upsertProfile } = await import('@/lib/profile')
      await upsertProfile({
        wallet_address: state.walletAddress,
        friend_permission: permission,
      })
    } catch (error) {
      // Rollback on failure
      set({
        myProfile: {
          nickname: state.myProfile?.nickname ?? null,
          avatarUrl: state.myProfile?.avatarUrl ?? null,
          friendPermission: oldPermission ?? FRIEND_PERMISSION_DEFAULT,
        },
      })
      console.error('[Profile] updateFriendPermission failed:', error)
      throw error
    }
  },

  loadProfiles: async (walletAddresses) => {
    if (walletAddresses.length === 0) return
    try {
      const { fetchProfiles } = await import('@/lib/profile')
      const profiles = await fetchProfiles(walletAddresses)
      set((s) => ({
        profileCache: { ...s.profileCache, ...profiles },
      }))
    } catch (error) {
      console.error('[Profile] loadProfiles failed:', error)
    }
  },

  getDisplayName: (walletAddress) => {
    const state = get()
    const addr = walletAddress.toLowerCase()
    // Check if it's the current user
    if (state.walletAddress?.toLowerCase() === addr && state.myProfile?.nickname) {
      return state.myProfile.nickname
    }
    // Check cache
    const cached = state.profileCache[addr]
    if (cached?.nickname) return cached.nickname
    // Fallback to truncated address
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
  },

  getAvatarUrl: (walletAddress) => {
    const state = get()
    const addr = walletAddress.toLowerCase()
    if (state.walletAddress?.toLowerCase() === addr) {
      return state.myProfile?.avatarUrl ?? null
    }
    return state.profileCache[addr]?.avatarUrl ?? null
  },
}))
