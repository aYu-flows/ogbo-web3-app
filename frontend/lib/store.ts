import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Signer } from 'ethers'
import { getStoredWallets, getActiveWallet, saveExternalWallet, removeExternalWallet, type StoredWallet as StoredWalletType } from '@/lib/walletCrypto'
import { supabase } from '@/lib/supabaseClient'
import { getChatId, addressToColor } from '@/lib/chat'
import type { ContactRow, MessageRow, GroupRow } from '@/lib/chat'

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
  updatePrices: () => void
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
  coins: mockCoins,
  dapps: mockDApps,
  unreadChatCount: 0,
  notifications: 3,
  isLoggedIn: false,
  walletAddress: null,

  // Supabase chat initial state
  chatReady: false,
  isConnectingChat: false,
  chatChannel: null,
  chatRequests: [],

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
    let storedWallets = getStoredWallets()
    // 若 address 是外部钱包地址且尚未持久化到 localStorage，则先持久化
    if (address && !storedWallets.some(w => w.address.toLowerCase() === address.toLowerCase())) {
      saveExternalWallet(address)
      storedWallets = getStoredWallets() // 重新加载以包含新记录
    }
    const activeWallet = getActiveWallet()
    const wallets = storedWallets.map(storedWalletToWallet)
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
    const currentWalletId = activeWallet?.id || wallets[0]?.id || ''
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
    // Prevent double-init
    if (state.chatReady || state.isConnectingChat) return

    const me = walletAddress.toLowerCase()
    set({ isConnectingChat: true, chats: [], chatRequests: [], unreadChatCount: 0 })

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
        .subscribe()

      set({ chatChannel: channel })
    } catch (error) {
      console.error('[Chat] initChat FAILED', error)
    } finally {
      set({ isConnectingChat: false })
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
        name: group.name,
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
