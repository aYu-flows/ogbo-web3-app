import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Signer } from 'ethers'
import { getStoredWallets, getActiveWallet, saveExternalWallet, removeExternalWallet, setActiveWalletId, type StoredWallet as StoredWalletType } from '@/lib/walletCrypto'
import { supabase } from '@/lib/supabaseClient'
import { getChatId, addressToColor } from '@/lib/chat'
import type { ContactRow, MessageRow, GroupRow } from '@/lib/chat'

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
  status: 'sent' | 'delivered' | 'read'
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

// ======== Helper: map DB rows to Chat objects ========

function contactToChat(contact: ContactRow, myAddress: string, lastMsg: MessageRow | null): Chat {
  const me = myAddress.toLowerCase()
  const peerAddr = contact.wallet_a.toLowerCase() === me ? contact.wallet_b : contact.wallet_a
  const chatId = getChatId(me, peerAddr)
  return {
    id: chatId,
    name: `${peerAddr.slice(0, 6)}...${peerAddr.slice(-4)}`,
    avatarColor: addressToColor(peerAddr),
    lastMessage: lastMsg?.content || '',
    timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(contact.created_at).getTime(),
    unread: 0,
    online: false,
    typing: false,
    type: 'personal',
    walletAddress: peerAddr,
    messages: [],
  }
}

function groupToChat(group: GroupRow, lastMsg: MessageRow | null): Chat {
  return {
    id: group.id,
    name: group.name,
    avatarColor: addressToColor(group.id),
    lastMessage: lastMsg?.content || '',
    timestamp: lastMsg ? new Date(lastMsg.created_at).getTime() : new Date(group.created_at).getTime(),
    unread: 0,
    online: false,
    typing: false,
    type: 'group',
    members: group.members.length,
    messages: [],
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

  switchTab: (tab: TabType) => void
  toggleBalance: () => void
  switchLocale: () => void
  switchWallet: (id: string) => void
  toggleCoinFavorite: (coinId: string) => void
  toggleDAppFavorite: (dappId: string) => void
  markChatRead: (chatId: string) => void
  pinChat: (chatId: string) => void
  deleteChat: (chatId: string) => void
  sendMessage: (chatId: string, content: string, sender?: string) => void
  initMarketData: () => Promise<void>
  updatePrices: () => Promise<void>
  getCurrentWallet: () => Wallet | undefined
  login: (address?: string) => void
  logout: () => void
  checkAuthStatus: () => void
  cleanupExternalWallet: (address: string) => void

  // OTA progress
  otaProgress: number | null   // null = inactive, 0-100 = downloading
  otaDone: boolean             // true briefly after bundle is scheduled
  setOtaProgress: (p: number | null) => void
  setOtaDone: (v: boolean) => void

  // Supabase chat actions
  initChat: (walletAddress: string) => Promise<void>
  destroyChat: () => void
  refreshChats: () => Promise<void>
  refreshChatRequests: () => Promise<void>
  acceptRequest: (fromAddress: string) => Promise<void>
  rejectRequest: (fromAddress: string) => Promise<void>
  sendFriendRequest: (address: string, message?: string) => Promise<void>
  sendPushMessage: (address: string, content: string) => Promise<void>
  sendGroupPushMessage: (chatId: string, content: string) => Promise<void>
  loadChatHistory: (chatId: string) => Promise<void>
  searchUserByAddress: (address: string) => Promise<any>
  createGroup: (groupName: string, memberAddresses: string[]) => Promise<void>
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

  // OTA progress initial state
  otaProgress: null,
  otaDone: false,
  setOtaProgress: (p) => set({ otaProgress: p }),
  setOtaDone: (v) => set({ otaDone: v }),

  // Supabase chat initial state
  chatReady: false,
  isConnectingChat: false,
  chatChannel: null,
  chatRequests: [],

  switchTab: (tab) => set({ activeTab: tab }),
  toggleBalance: () => set((s) => ({ isBalanceVisible: !s.isBalanceVisible })),
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
      // 优先尝试从 localStorage 还原上次缓存数据
      const cache = loadMarketCache()
      if (cache.length > 0) {
        // 将缓存市场数据 merge 进 coins（保留 favorited 与静态字段）
        set((s) => ({
          coins: s.coins.map(c => {
            const cached = cache.find(e => e.id === c.id)
            if (!cached) return c
            return { ...c, ...cached }  // cached 覆盖市场数据字段（含 chartData）
          }),
          marketLoading: false,  // 有缓存数据，跳过骨架屏直接展示
        }))
        // 有缓存数据：后台静默刷新最新价格，成功则覆盖显示，失败则保留缓存数据
        await get().updatePrices()
        return
      }
      // 无缓存（首次安装）：走原有骨架屏逻辑
      set({ marketLoading: true, marketError: null })
    }

    // Step 1: 拉取主行情数据
    await get().updatePrices()

    // Step 2: 首次加载时并发拉取16个代币走势图
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
            // 降级：用当前价格生成随机走势图，优先于显示空图
            // 注意：若 prices 为空数组（API 返回空数据），也触发此降级路径
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
      // 首次加载走势图完成后，补存完整缓存（含 chartData）
      // updatePrices 在价格请求成功时已写入缓存，但彼时 chartData 尚为空；此处补存一次完整数据
      saveMarketCache(get().coins)
      // 无论 updatePrices 成功与否，首次加载流程结束后必须复位 loading
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

      // Build Chat objects
      const personalChats = contacts.map(c => {
        const peerAddr = c.wallet_a.toLowerCase() === me ? c.wallet_b : c.wallet_a
        const chatId = getChatId(me, peerAddr)
        return contactToChat(c, me, lastMsgs[chatId] || null)
      })
      const groupChats = groups.map(g => groupToChat(g, lastMsgs[g.id] || null))
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

      set({ chats, chatRequests, chatReady: true })

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

            const newMsg: Message = {
              id: `db-${msg.id}`,
              sender: isMe ? 'me' : msg.sender,
              content: msg.content,
              timestamp: new Date(msg.created_at).getTime(),
              status: 'sent',
            }

            set((s) => {
              const chats = s.chats.map((c) => {
                if (c.id !== msg.chat_id) return c

                // Deduplicate own messages: replace optimistic message with confirmed one
                if (isMe) {
                  const optIdx = c.messages.reduceRight((found, m, idx) => {
                    if (found !== -1) return found
                    if (m.sender === 'me' && m.content === msg.content && m.id.startsWith('opt-')) return idx
                    return -1
                  }, -1)
                  if (optIdx !== -1) {
                    const messages = [...c.messages]
                    messages[optIdx] = newMsg
                    return { ...c, lastMessage: msg.content, timestamp: newMsg.timestamp, messages }
                  }
                }

                return {
                  ...c,
                  lastMessage: msg.content,
                  timestamp: newMsg.timestamp,
                  unread: c.unread + (isMe ? 0 : 1),
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
            if (contact.status !== 'pending') return
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
            pinned: existing?.pinned,
          }
        })

        const chats = [...personalChats, ...groupChats].sort((a, b) => b.timestamp - a.timestamp)
        return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
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
    if (!state.walletAddress) return
    try {
      const { sendFriendRequest: supabaseSend } = await import('@/lib/chat')
      await supabaseSend(state.walletAddress, address, message)
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

  searchUserByAddress: async (address) => {
    // With Supabase, any valid EVM address is searchable — no network call needed
    const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
    if (!ADDRESS_REGEX.test(address)) return null
    return { address: address.toLowerCase() }
  },

  loadChatHistory: async (chatId) => {
    const state = get()
    if (!state.walletAddress) return
    const me = state.walletAddress.toLowerCase()
    try {
      const { fetchMessages } = await import('@/lib/chat')
      const rawMsgs = await fetchMessages(chatId, 50)
      const messages: Message[] = rawMsgs.map(msg => ({
        id: `db-${msg.id}`,
        sender: msg.sender.toLowerCase() === me ? 'me' as const : msg.sender,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime(),
        status: 'read' as const,
      }))
      set((s) => ({
        chats: s.chats.map((c) => (c.id === chatId ? { ...c, messages } : c)),
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
}))
