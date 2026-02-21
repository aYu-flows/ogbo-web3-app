import { create } from 'zustand'
import type { PushAPI } from '@pushprotocol/restapi'
import type { Signer } from 'ethers'
import { getStoredWallets, getActiveWallet, type StoredWallet as StoredWalletType } from '@/lib/walletCrypto'

export type TabType = 'home' | 'chat' | 'market' | 'discover' | 'assets'
export type Locale = 'zh' | 'en'

export interface ChatRequest {
  fromAddress: string
  fromDID: string
  message: string
  timestamp: number
  chatId: string
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
}

export interface Message {
  id: string
  sender: 'me' | string
  content: string
  timestamp: number
  status: 'sent' | 'delivered' | 'read'
  pushMessageId?: string
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
  pushChatId?: string
  did?: string
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
  }
}

const mockChats: Chat[] = [
  {
    id: '1', name: 'Alice', avatarColor: '#3b82f6', lastMessage: '嗨，今天行情不错！',
    timestamp: Date.now() - 120000, unread: 3, online: true, typing: false, type: 'personal',
    messages: [
      { id: 'm1', sender: 'alice', content: '你好！最近怎么样？', timestamp: Date.now() - 7200000, status: 'read' },
      { id: 'm2', sender: 'me', content: '挺好的，在看行情', timestamp: Date.now() - 7000000, status: 'read' },
      { id: 'm3', sender: 'alice', content: 'BTC今天涨了不少', timestamp: Date.now() - 6800000, status: 'read' },
      { id: 'm4', sender: 'me', content: '是啊，我也注意到了', timestamp: Date.now() - 6600000, status: 'read' },
      { id: 'm5', sender: 'alice', content: '嗨，今天行情不错！', timestamp: Date.now() - 120000, status: 'read' },
    ],
  },
  {
    id: '2', name: 'Crypto Group', avatarColor: '#8b5cf6', lastMessage: 'Bob: 大家准备好了吗？',
    timestamp: Date.now() - 86400000, unread: 15, online: false, typing: false, type: 'group', members: 24,
    messages: [
      { id: 'm1', sender: 'bob', content: '大家好！', timestamp: Date.now() - 172800000, status: 'read' },
      { id: 'm2', sender: 'carol', content: '新项目发布了', timestamp: Date.now() - 90000000, status: 'read' },
      { id: 'm3', sender: 'bob', content: '大家准备好了吗？', timestamp: Date.now() - 86400000, status: 'read' },
    ],
  },
  {
    id: '3', name: 'Carol', avatarColor: '#ec4899', lastMessage: '好的，我知道了',
    timestamp: Date.now() - 172800000, unread: 0, online: false, typing: false, type: 'personal',
    messages: [
      { id: 'm1', sender: 'me', content: '明天有空吗？', timestamp: Date.now() - 180000000, status: 'read' },
      { id: 'm2', sender: 'carol', content: '好的，我知道了', timestamp: Date.now() - 172800000, status: 'read' },
    ],
  },
  {
    id: '4', name: 'David', avatarColor: '#f59e0b', lastMessage: '那个NFT项目你看了吗？',
    timestamp: Date.now() - 259200000, unread: 1, online: true, typing: false, type: 'personal',
    messages: [
      { id: 'm1', sender: 'david', content: '那个NFT项目你看了吗？', timestamp: Date.now() - 259200000, status: 'delivered' },
    ],
  },
  {
    id: '5', name: 'DeFi研究院', avatarColor: '#10b981', lastMessage: 'Eva: 新的协议分析报告已发布',
    timestamp: Date.now() - 345600000, unread: 8, online: false, typing: false, type: 'group', members: 156,
    messages: [
      { id: 'm1', sender: 'eva', content: '新的协议分析报告已发布', timestamp: Date.now() - 345600000, status: 'read' },
    ],
  },
  {
    id: '6', name: 'Frank', avatarColor: '#06b6d4', lastMessage: '转账已确认',
    timestamp: Date.now() - 432000000, unread: 0, online: false, typing: false, type: 'personal',
    messages: [
      { id: 'm1', sender: 'frank', content: '转账已确认', timestamp: Date.now() - 432000000, status: 'read' },
    ],
  },
  {
    id: '7', name: 'Grace', avatarColor: '#f97316', lastMessage: '周末一起聊聊新项目？',
    timestamp: Date.now() - 518400000, unread: 0, online: true, typing: false, type: 'personal',
    messages: [
      { id: 'm1', sender: 'grace', content: '周末一起聊聊新项目？', timestamp: Date.now() - 518400000, status: 'read' },
    ],
  },
  {
    id: '8', name: 'NFT交流群', avatarColor: '#ef4444', lastMessage: 'Henry: 这个系列值得关注',
    timestamp: Date.now() - 604800000, unread: 42, online: false, typing: false, type: 'group', members: 89,
    messages: [
      { id: 'm1', sender: 'henry', content: '这个系列值得关注', timestamp: Date.now() - 604800000, status: 'read' },
    ],
  },
]

const mockCoins: Coin[] = [
  { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 45234.56, change24h: 2.5, volume: '28.3B', marketCap: '890B', high24h: 46234, low24h: 44123, supply: '19.2M', maxSupply: '21M', icon: '₿', chartData: generateChartData(24, 45000), favorited: false },
  { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 2891.23, change24h: -0.8, volume: '11.1B', marketCap: '348B', high24h: 2950, low24h: 2850, supply: '120M', maxSupply: '-', icon: 'Ξ', chartData: generateChartData(24, 2890), favorited: false },
  { id: 'bnb', symbol: 'BNB', name: 'BNB', price: 312.45, change24h: 1.2, volume: '890M', marketCap: '48B', high24h: 318, low24h: 308, supply: '153M', maxSupply: '200M', icon: '◆', chartData: generateChartData(24, 312), favorited: false },
  { id: 'sol', symbol: 'SOL', name: 'Solana', price: 98.76, change24h: 5.3, volume: '2.1B', marketCap: '42B', high24h: 102, low24h: 95, supply: '430M', maxSupply: '-', icon: 'S', chartData: generateChartData(24, 98), favorited: false },
  { id: 'ada', symbol: 'ADA', name: 'Cardano', price: 0.43, change24h: -1.5, volume: '456M', marketCap: '15B', high24h: 0.45, low24h: 0.41, supply: '35B', maxSupply: '45B', icon: 'A', chartData: generateChartData(24, 0.43), favorited: false },
  { id: 'dot', symbol: 'DOT', name: 'Polkadot', price: 7.23, change24h: 0.9, volume: '234M', marketCap: '9.2B', high24h: 7.45, low24h: 7.01, supply: '1.3B', maxSupply: '-', icon: 'D', chartData: generateChartData(24, 7.2), favorited: false },
  { id: 'matic', symbol: 'MATIC', name: 'Polygon', price: 0.89, change24h: 3.2, volume: '567M', marketCap: '8.3B', high24h: 0.92, low24h: 0.86, supply: '9.3B', maxSupply: '10B', icon: 'M', chartData: generateChartData(24, 0.89), favorited: false },
  { id: 'link', symbol: 'LINK', name: 'Chainlink', price: 14.56, change24h: -2.1, volume: '678M', marketCap: '8.1B', high24h: 15.2, low24h: 14.1, supply: '556M', maxSupply: '1B', icon: 'L', chartData: generateChartData(24, 14.5), favorited: false },
  { id: 'uni', symbol: 'UNI', name: 'Uniswap', price: 6.78, change24h: 1.8, volume: '234M', marketCap: '5.1B', high24h: 7.0, low24h: 6.5, supply: '753M', maxSupply: '1B', icon: 'U', chartData: generateChartData(24, 6.7), favorited: false },
  { id: 'aave', symbol: 'AAVE', name: 'Aave', price: 92.34, change24h: -0.3, volume: '123M', marketCap: '1.4B', high24h: 94, low24h: 91, supply: '14.8M', maxSupply: '16M', icon: 'A', chartData: generateChartData(24, 92), favorited: false },
  { id: 'avax', symbol: 'AVAX', name: 'Avalanche', price: 35.67, change24h: 4.1, volume: '456M', marketCap: '13B', high24h: 37, low24h: 34, supply: '365M', maxSupply: '720M', icon: 'V', chartData: generateChartData(24, 35), favorited: false },
  { id: 'atom', symbol: 'ATOM', name: 'Cosmos', price: 9.12, change24h: -1.8, volume: '189M', marketCap: '3.5B', high24h: 9.5, low24h: 8.9, supply: '386M', maxSupply: '-', icon: 'C', chartData: generateChartData(24, 9.1), favorited: false },
  { id: 'xlm', symbol: 'XLM', name: 'Stellar', price: 0.12, change24h: 0.5, volume: '78M', marketCap: '3.4B', high24h: 0.125, low24h: 0.118, supply: '28B', maxSupply: '50B', icon: 'X', chartData: generateChartData(24, 0.12), favorited: false },
  { id: 'algo', symbol: 'ALGO', name: 'Algorand', price: 0.18, change24h: 2.3, volume: '56M', marketCap: '1.4B', high24h: 0.19, low24h: 0.17, supply: '7.8B', maxSupply: '10B', icon: 'G', chartData: generateChartData(24, 0.18), favorited: false },
  { id: 'near', symbol: 'NEAR', name: 'NEAR Protocol', price: 3.45, change24h: 6.7, volume: '234M', marketCap: '3.7B', high24h: 3.6, low24h: 3.2, supply: '1.08B', maxSupply: '-', icon: 'N', chartData: generateChartData(24, 3.4), favorited: false },
  { id: 'ftm', symbol: 'FTM', name: 'Fantom', price: 0.42, change24h: -3.2, volume: '134M', marketCap: '1.2B', high24h: 0.45, low24h: 0.4, supply: '2.8B', maxSupply: '3.2B', icon: 'F', chartData: generateChartData(24, 0.42), favorited: false },
]

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

  // Push Protocol state
  pushUser: PushAPI | null
  chatRequests: ChatRequest[]
  pushInitialized: boolean
  isConnectingPush: boolean
  pushInitFailed: boolean

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
  updatePrices: () => void
  getCurrentWallet: () => Wallet | undefined
  login: (address?: string) => void
  logout: () => void
  checkAuthStatus: () => void

  // Push Protocol actions
  initPush: (signer: Signer) => Promise<void>
  destroyPush: () => void
  resetPushFailed: () => void
  refreshChats: () => Promise<void>
  refreshChatRequests: () => Promise<void>
  acceptRequest: (address: string) => Promise<void>
  rejectRequest: (address: string) => Promise<void>
  sendFriendRequest: (address: string, message?: string) => Promise<void>
  sendPushMessage: (address: string, content: string) => Promise<void>
  loadChatHistory: (address: string) => Promise<void>
  searchUserByAddress: (address: string) => Promise<any>
  createGroup: (groupName: string, memberAddresses: string[]) => Promise<void>
  sendGroupPushMessage: (chatId: string, content: string) => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  activeTab: 'chat',
  locale: 'zh',
  isBalanceVisible: true,
  currentWalletId: '',
  wallets: [],        // 由 checkAuthStatus() 在客户端从 localStorage 加载，SSR 安全
  chats: mockChats,
  coins: mockCoins,
  dapps: mockDApps,
  unreadChatCount: mockChats.reduce((acc, c) => acc + c.unread, 0),
  notifications: 3,
  isLoggedIn: false,
  walletAddress: null,

  // Push Protocol initial state
  pushUser: null,
  chatRequests: [],
  pushInitialized: false,
  isConnectingPush: false,
  pushInitFailed: false,

  switchTab: (tab) => set({ activeTab: tab }),
  toggleBalance: () => set((s) => ({ isBalanceVisible: !s.isBalanceVisible })),
  switchLocale: () => set((s) => ({ locale: s.locale === 'zh' ? 'en' : 'zh' })),
  switchWallet: (id) => set({ currentWalletId: id }),
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
  updatePrices: () =>
    set((s) => ({
      coins: s.coins.map((c) => ({
        ...c,
        price: c.price * (1 + (Math.random() - 0.5) * 0.002),
        chartData: [...c.chartData.slice(1), { time: Date.now(), price: c.price * (1 + (Math.random() - 0.5) * 0.002) }],
      })),
    })),
  getCurrentWallet: () => {
    const s = get()
    return s.wallets.find((w) => w.id === s.currentWalletId) || s.wallets[0]
  },
  login: (address?: string) => {
    const storedWallets = getStoredWallets()
    const activeWallet = getActiveWallet()
    let wallets = storedWallets.map(storedWalletToWallet)
    // wagmi/外部钱包用户：localStorage 无 keystore，构造视图用 Wallet，追加而非覆盖
    if (address && !wallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
      wallets = [
        ...wallets,
        {
          id: `external-${address.toLowerCase()}`,
          name: 'Connected Wallet',
          address,
          balance: { cny: 0, usd: 0 },
          tokens: [],
          nfts: [],
          transactions: [],
        },
      ]
    }
    const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
    set({
      isLoggedIn: true,
      walletAddress: address || null,
      wallets,
      currentWalletId,
    })
    if (typeof window !== 'undefined') {
      localStorage.setItem('ogbo_logged_in', 'true')
      if (address) localStorage.setItem('ogbo_wallet_address', address)
    }
  },
  logout: () => {
    // 清除 sessionStorage 中的 session key（明文私钥）
    if (typeof window !== 'undefined') {
      try { window.sessionStorage.removeItem('ogbo_session_pk') } catch { /* ignore */ }
    }
    set({ isLoggedIn: false, walletAddress: null })
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
    const storedWallets = getStoredWallets()
    const activeWallet = getActiveWallet()
    let wallets = storedWallets.map(storedWalletToWallet)
    // wagmi/外部钱包用户：localStorage 无 keystore，构造视图用 Wallet，追加而非覆盖
    if (savedAddress && !wallets.some(w => w.address.toLowerCase() === savedAddress.toLowerCase())) {
      wallets = [
        ...wallets,
        {
          id: `external-${savedAddress.toLowerCase()}`,
          name: 'Connected Wallet',
          address: savedAddress,
          balance: { cny: 0, usd: 0 },
          tokens: [],
          nfts: [],
          transactions: [],
        },
      ]
    }
    const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
    set({ isLoggedIn, walletAddress: savedAddress, wallets, currentWalletId })
  },

  // ======== Push Protocol Actions ========

  initPush: async (signer) => {
    // Clear any stale/mock chat data immediately so the user never sees mock chats
    set({ isConnectingPush: true, chats: [], chatRequests: [], unreadChatCount: 0 })
    try {
      const { initPushUser, setupSocketListeners, fetchChats: fetchPushChats, fetchChatRequests: fetchPushRequests, pushFeedToChat, pushRequestToChatRequest, pushMessageToMessage, autoAcceptFriendGroupInvites } = await import('@/lib/push')
      const pushUser = await initPushUser(signer)
      set({ pushUser, pushInitialized: true })

      // Ensure walletAddress is set - derive from signer if store doesn't have it yet
      const state = get()
      let myAddress = state.walletAddress || ''
      if (!myAddress) {
        try {
          myAddress = await (signer as any).getAddress() || ''
        } catch { /* ignore */ }
      }
      if (myAddress) {
        const storedWallets = getStoredWallets()
        const activeWallet = getActiveWallet()
        let wallets = storedWallets.map(storedWalletToWallet)
        if (!wallets.some(w => w.address.toLowerCase() === myAddress.toLowerCase())) {
          wallets = [
            ...wallets,
            {
              id: `external-${myAddress.toLowerCase()}`,
              name: 'Connected Wallet',
              address: myAddress,
              balance: { cny: 0, usd: 0 },
              tokens: [],
              nfts: [],
              transactions: [],
            },
          ]
        }
        const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
        set({ walletAddress: myAddress, wallets, currentWalletId })
      }

      // Load chats and requests
      const [rawChats, rawRequests] = await Promise.all([
        fetchPushChats(pushUser),
        fetchPushRequests(pushUser),
      ])

      const chats = rawChats.map((feed: any) => pushFeedToChat(feed, myAddress))
      const chatRequests = rawRequests.map((feed: any) => pushRequestToChatRequest(feed))
      const unreadChatCount = chats.reduce((acc: number, c: any) => acc + (c.unread || 0), 0)
      set({ chats, chatRequests, unreadChatCount })

      // Auto-accept group invites from existing friends
      const friendAddresses = chats.filter((c: any) => c.walletAddress).map((c: any) => c.walletAddress as string)
      if (friendAddresses.length > 0) {
        await autoAcceptFriendGroupInvites(pushUser, friendAddresses)
        // Re-fetch chats to include any newly joined groups
        const updatedRawChats = await fetchPushChats(pushUser)
        const updatedChats = updatedRawChats.map((feed: any) => pushFeedToChat(feed, myAddress))
        const updatedUnread = updatedChats.reduce((acc: number, c: any) => acc + (c.unread || 0), 0)
        set({ chats: updatedChats, unreadChatCount: updatedUnread })
      }

      // Setup WebSocket listeners
      setupSocketListeners(pushUser, {
        onMessage: (data: any) => {
          const s = get()
          const addr = s.walletAddress || ''
          const msg = pushMessageToMessage(data, addr)
          const chatId = data.chatId || data.chatid || ''
          // Strip eip155 prefix from data.from and data.to for address matching
          const fromAddress = (data.from || '').replace(/^eip155:\d*:?/i, '')
          const toAddress = (Array.isArray(data.to) ? data.to[0] : data.to || '').replace(/^eip155:\d*:?/i, '')
          set((state) => {
            const chats = state.chats.map((c) => {
              const matchById = chatId && c.pushChatId === chatId
              const matchByFrom = fromAddress && c.walletAddress?.toLowerCase() === fromAddress.toLowerCase()
              const matchByTo = toAddress && c.walletAddress?.toLowerCase() === toAddress.toLowerCase()
              if (!matchById && !matchByFrom && !matchByTo) return c

              // Skip if already confirmed by pushMessageId (exact dedup)
              if (msg.pushMessageId && c.messages.some((m) => m.pushMessageId === msg.pushMessageId)) {
                return c
              }

              // For own messages: replace the matching optimistic message instead of duplicating.
              // Optimistic messages have no pushMessageId, same content, sender='me'.
              if (msg.sender === 'me') {
                let optimisticIdx = -1
                for (let i = c.messages.length - 1; i >= 0; i--) {
                  const m = c.messages[i]
                  if (!m.pushMessageId && m.sender === 'me' && m.content === msg.content) {
                    optimisticIdx = i
                    break
                  }
                }
                if (optimisticIdx !== -1) {
                  const messages = [...c.messages]
                  messages[optimisticIdx] = msg
                  return { ...c, lastMessage: msg.content, timestamp: msg.timestamp, messages }
                }
              }

              return {
                ...c,
                lastMessage: msg.content,
                timestamp: msg.timestamp,
                unread: c.unread + (msg.sender !== 'me' ? 1 : 0),
                messages: [...c.messages, msg],
              }
            })
            return { chats, unreadChatCount: chats.reduce((acc, c) => acc + c.unread, 0) }
          })
        },
        onRequest: async (data: any) => {
          // Group invite: if creator is an existing friend, auto-accept silently
          if (data.groupInformation) {
            const creatorRaw = data.groupInformation.groupCreator || ''
            const creatorAddr = creatorRaw.replace(/^eip155:\d*:?/i, '')
            const s = get()
            const isFriend = s.chats.some((c) => c.walletAddress?.toLowerCase() === creatorAddr.toLowerCase())
            if (isFriend && s.pushUser && data.chatId) {
              try {
                await s.pushUser.chat.accept(data.chatId)
                await get().refreshChats()
              } catch { /* ignore */ }
            }
            return
          }
          // Personal friend request: add to chatRequests list
          const newRequest = pushRequestToChatRequest(data)
          set((state) => {
            const exists = state.chatRequests.some((r) => r.fromAddress.toLowerCase() === newRequest.fromAddress.toLowerCase())
            if (exists) return {}
            return { chatRequests: [...state.chatRequests, newRequest] }
          })
        },
        onAccept: () => {
          get().refreshChats()
        },
      })
    } catch (error: any) {
      console.error('Push init failed:', error)
      set({ pushInitFailed: true })
    } finally {
      set({ isConnectingPush: false })
    }
  },

  destroyPush: () => {
    const state = get()
    if (state.pushUser) {
      try {
        state.pushUser.stream?.removeAllListeners?.()
        state.pushUser.stream?.disconnect?.()
      } catch {
        // ignore
      }
    }
    set({
      pushUser: null,
      chatRequests: [],
      pushInitialized: false,
      isConnectingPush: false,
      pushInitFailed: false,
      walletAddress: null,
      chats: [],
      unreadChatCount: 0,
    })
  },

  resetPushFailed: () => {
    // Resets the push-failed flag so page.tsx useEffect can retry initPush automatically.
    // Does NOT call initPush directly - the page-level effects handle re-initialization.
    set({ pushInitFailed: false, pushInitialized: false })
  },

  refreshChats: async () => {
    const state = get()
    if (!state.pushUser || !state.pushInitialized) return
    try {
      const { fetchChats: fetchPushChats, pushFeedToChat } = await import('@/lib/push')
      const rawChats = await fetchPushChats(state.pushUser)
      const chats = rawChats.map((feed: any) => pushFeedToChat(feed, state.walletAddress || ''))
      const unreadChatCount = chats.reduce((acc: number, c: any) => acc + (c.unread || 0), 0)
      set({ chats, unreadChatCount })
    } catch (error) {
      console.error('refreshChats failed:', error)
    }
  },

  refreshChatRequests: async () => {
    const state = get()
    if (!state.pushUser || !state.pushInitialized) return
    try {
      const { fetchChatRequests: fetchPushRequests, pushRequestToChatRequest } = await import('@/lib/push')
      const rawRequests = await fetchPushRequests(state.pushUser)
      const chatRequests = rawRequests.map((feed: any) => pushRequestToChatRequest(feed))
      set({ chatRequests })
    } catch (error) {
      console.error('refreshChatRequests failed:', error)
    }
  },

  acceptRequest: async (address) => {
    const state = get()
    if (!state.pushUser) return
    try {
      const { acceptChatRequest } = await import('@/lib/push')
      await acceptChatRequest(state.pushUser, address)
      set((s) => ({
        chatRequests: s.chatRequests.filter((r) => r.fromAddress.toLowerCase() !== address.toLowerCase()),
      }))
      await get().refreshChats()
      const { default: toast } = await import('react-hot-toast')
      const locale = get().locale
      const msg = locale === 'zh' ? '已接受好友请求，快去打招呼吧！' : 'Friend request accepted! Say hi!'
      toast.success(msg)
    } catch (error) {
      console.error('acceptRequest failed:', error)
      const { default: toast } = await import('react-hot-toast')
      toast.error(get().locale === 'zh' ? '操作失败，请重试' : 'Failed, please retry')
    }
  },

  rejectRequest: async (address) => {
    const state = get()
    if (!state.pushUser) return
    try {
      const { rejectChatRequest } = await import('@/lib/push')
      await rejectChatRequest(state.pushUser, address)
      set((s) => ({
        chatRequests: s.chatRequests.filter((r) => r.fromAddress.toLowerCase() !== address.toLowerCase()),
      }))
      const { default: toast } = await import('react-hot-toast')
      const locale = get().locale
      toast.success(locale === 'zh' ? '已拒绝请求' : 'Request rejected')
    } catch (error) {
      console.error('rejectRequest failed:', error)
    }
  },

  sendFriendRequest: async (address, message) => {
    const state = get()
    if (!state.pushUser) return
    try {
      const { sendChatRequest } = await import('@/lib/push')
      await sendChatRequest(state.pushUser, address, message || '')
    } catch (error) {
      console.error('sendFriendRequest failed:', error)
      throw error
    }
  },

  sendPushMessage: async (address, content) => {
    const state = get()
    if (!state.pushUser) return
    try {
      const { sendMessage: pushSend } = await import('@/lib/push')
      await pushSend(state.pushUser, address, content)
      // Optimistically add message to local state
      const msg = {
        id: `m${Date.now()}`,
        sender: 'me' as const,
        content,
        timestamp: Date.now(),
        status: 'sent' as const,
      }
      set((s) => ({
        chats: s.chats.map((c) =>
          c.walletAddress?.toLowerCase() === address.toLowerCase()
            ? { ...c, lastMessage: content, timestamp: Date.now(), messages: [...c.messages, msg] }
            : c
        ),
      }))
    } catch (error) {
      console.error('sendPushMessage failed:', error)
      throw error
    }
  },

  searchUserByAddress: async (address) => {
    const state = get()
    if (!state.pushUser) return null
    try {
      const { getUserInfo } = await import('@/lib/push')
      return await getUserInfo(state.pushUser, address)
    } catch (error) {
      console.error('searchUserByAddress failed:', error)
      return null
    }
  },

  loadChatHistory: async (address) => {
    const state = get()
    if (!state.pushUser || !state.walletAddress) return
    try {
      const { fetchChatHistory, pushMessageToMessage } = await import('@/lib/push')
      const rawMsgs = await fetchChatHistory(state.pushUser, address, 30)
      const messages = rawMsgs
        .map((msg: any) => pushMessageToMessage(msg, state.walletAddress!))
        .reverse()
      set((s) => ({
        chats: s.chats.map((c) => {
          const matchByWallet = c.walletAddress?.toLowerCase() === address.toLowerCase()
          const matchByChatId = c.pushChatId === address
          return (matchByWallet || matchByChatId) ? { ...c, messages } : c
        }),
      }))
    } catch (error) {
      console.error('loadChatHistory failed:', error)
    }
  },

  createGroup: async (groupName, memberAddresses) => {
    const state = get()
    if (!state.pushUser || !state.pushInitialized) {
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
      const { createGroupChat, addressToColor } = await import('@/lib/push')
      const { t } = await import('@/lib/i18n')
      const locale = get().locale
      const finalName = groupName.trim() ||
        (locale === 'zh' ? `群聊（${memberAddresses.length + 1}人）` : `Group (${memberAddresses.length + 1})`)
      const { chatId, name } = await createGroupChat(state.pushUser, finalName, memberAddresses)
      const newChat: Chat = {
        id: chatId,
        name,
        avatarColor: addressToColor(chatId),
        lastMessage: locale === 'zh' ? '群聊已创建' : 'Group created',
        timestamp: Date.now(),
        unread: 0,
        online: false,
        typing: false,
        type: 'group',
        members: memberAddresses.length + 1,
        pinned: false,
        messages: [],
        walletAddress: undefined,
        pushChatId: chatId,
        did: undefined,
      }
      set((s) => ({
        chats: [newChat, ...s.chats],
        unreadChatCount: s.unreadChatCount,
      }))
      const { default: toast } = await import('react-hot-toast')
      toast.success(t('chat.groupCreated', get().locale))
    } catch (error) {
      console.error('createGroup failed:', error)
      if (error instanceof Error) console.error('[createGroup] message:', error.message)
      const { default: toast } = await import('react-hot-toast')
      const { t } = await import('@/lib/i18n')
      toast.error(t('chat.groupCreateFailed', get().locale))
      throw error
    }
  },

  sendGroupPushMessage: async (chatId, content) => {
    const state = get()
    if (!state.pushUser) return
    try {
      const { sendMessage: pushSend } = await import('@/lib/push')
      await pushSend(state.pushUser, chatId, content)
      // Optimistically add message to local state
      const msg = {
        id: `m${Date.now()}`,
        sender: 'me' as const,
        content,
        timestamp: Date.now(),
        status: 'sent' as const,
      }
      set((s) => ({
        chats: s.chats.map((c) =>
          c.pushChatId === chatId
            ? { ...c, lastMessage: content, timestamp: Date.now(), messages: [...c.messages, msg] }
            : c
        ),
      }))
    } catch (error) {
      console.error('sendGroupPushMessage failed:', error)
      throw error
    }
  },
}))
