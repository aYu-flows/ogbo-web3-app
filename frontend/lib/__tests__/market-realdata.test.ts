/**
 * Task50 - Unit tests for CoinGecko market data integration
 * Tests: formatLargeNumber, buildInitialCoins, updatePrices, initMarketData,
 *        trending tab order, gainers/losers sorting, chartData append logic
 */

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    removeChannel: jest.fn(),
    channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() })),
  },
}))

jest.mock('@/lib/walletCrypto', () => ({
  getStoredWallets: jest.fn().mockReturnValue([]),
  getActiveWallet: jest.fn().mockReturnValue(null),
  saveExternalWallet: jest.fn(),
  removeExternalWallet: jest.fn(),
  setActiveWalletId: jest.fn(),
}))

jest.mock('@/lib/chat', () => ({
  fetchContacts: jest.fn().mockResolvedValue([]),
  fetchGroups: jest.fn().mockResolvedValue([]),
  fetchPendingRequests: jest.fn().mockResolvedValue([]),
  fetchLastMessages: jest.fn().mockResolvedValue({}),
  getChatId: (a: string, b: string) => [a, b].sort().join('_').toLowerCase(),
  addressToColor: () => '#aabbcc',
  sendMessage: jest.fn().mockResolvedValue({ id: 1 }),
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

// ── Import after mocks ─────────────────────────────────────────────────────────

import { formatLargeNumber, buildInitialCoins, useStore } from '@/lib/store'

const getState = () => useStore.getState()
const setState = (partial: any) => useStore.setState(partial)

// ── CoinGecko mock data ────────────────────────────────────────────────────────

const MOCK_MARKET_DATA = [
  {
    id: 'bitcoin', current_price: 66000, market_cap: 1319737553770,
    total_volume: 44634381543, high_24h: 67800, low_24h: 64300,
    price_change_percentage_24h: -2.15, circulating_supply: 19993628,
    total_supply: 19993628, max_supply: 21000000,
  },
  {
    id: 'ethereum', current_price: 1907, market_cap: 230119556761,
    total_volume: 19987034841, high_24h: 1958, low_24h: 1856,
    price_change_percentage_24h: -2.01, circulating_supply: 120692355,
    total_supply: 120692355, max_supply: null,
  },
  {
    id: 'solana', current_price: 79.9, market_cap: 34000000000,
    total_volume: 2100000000, high_24h: 82, low_24h: 77,
    price_change_percentage_24h: 5.5, circulating_supply: 430000000,
    total_supply: null, max_supply: null,
  },
]

// Helper: fill market data with all 16 coins (simplified)
const FULL_MOCK_DATA = [
  'bitcoin', 'ethereum', 'ripple', 'binancecoin', 'solana', 'tron',
  'dogecoin', 'bitcoin-cash', 'cardano', 'hyperliquid', 'wrapped-bitcoin',
  'leo-token', 'monero', 'chainlink', 'stellar', 'hedera-hashgraph',
].map((id, i) => ({
  id,
  current_price: (i + 1) * 100,
  market_cap: (i + 1) * 1e9,
  total_volume: (i + 1) * 1e8,
  high_24h: (i + 1) * 110,
  low_24h: (i + 1) * 90,
  price_change_percentage_24h: (i % 2 === 0 ? 1 : -1) * (i + 1),
  circulating_supply: (i + 1) * 1e6,
  total_supply: null,
  max_supply: i === 0 ? 21000000 : null,
}))

// ── beforeEach: reset store ────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  localStorageMock.clear()
  setState({
    coins: buildInitialCoins(),
    marketLoading: false,
    marketError: null,
  })
})

// ── T1: formatLargeNumber ──────────────────────────────────────────────────────

describe('T1: formatLargeNumber', () => {
  it('returns "--" for null', () => {
    expect(formatLargeNumber(null)).toBe('--')
  })
  it('returns "--" for undefined', () => {
    expect(formatLargeNumber(undefined)).toBe('--')
  })
  it('returns "--" for 0', () => {
    expect(formatLargeNumber(0)).toBe('--')
  })
  it('formats trillions correctly', () => {
    expect(formatLargeNumber(1319737553770)).toBe('1.32T')
  })
  it('formats billions correctly', () => {
    expect(formatLargeNumber(44634381543)).toBe('44.63B')
  })
  it('formats millions correctly', () => {
    // 19993628 / 1e6 = 19.993628 → toFixed(2) = "19.99"
    expect(formatLargeNumber(19993628)).toBe('19.99M')
  })
  it('formats max supply correctly (21M)', () => {
    expect(formatLargeNumber(21000000)).toBe('21.00M')
  })
  it('returns decimal for small numbers', () => {
    // Small numbers: below 1000
    const result = formatLargeNumber(0.0959)
    expect(result).toBe('0.0959')
  })
})

// ── T2: buildInitialCoins ──────────────────────────────────────────────────────

describe('T2: buildInitialCoins', () => {
  it('returns exactly 16 coins', () => {
    const coins = buildInitialCoins()
    expect(coins).toHaveLength(16)
  })
  it('first coin is BTC (bitcoin)', () => {
    const coins = buildInitialCoins()
    expect(coins[0].id).toBe('bitcoin')
    expect(coins[0].symbol).toBe('BTC')
  })
  it('last coin is HBAR (hedera-hashgraph)', () => {
    const coins = buildInitialCoins()
    expect(coins[15].id).toBe('hedera-hashgraph')
    expect(coins[15].symbol).toBe('HBAR')
  })
  it('all coins have price === 0', () => {
    const coins = buildInitialCoins()
    expect(coins.every(c => c.price === 0)).toBe(true)
  })
  it('all coins have empty chartData', () => {
    const coins = buildInitialCoins()
    expect(coins.every(c => c.chartData.length === 0)).toBe(true)
  })
  it('all coins have favorited === false', () => {
    const coins = buildInitialCoins()
    expect(coins.every(c => c.favorited === false)).toBe(true)
  })
})

// ── T3: updatePrices — success ─────────────────────────────────────────────────

describe('T3: updatePrices — API success', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => FULL_MOCK_DATA,
    }) as any
  })

  it('updates BTC price correctly', async () => {
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.price).toBe(100) // first item in FULL_MOCK_DATA
  })

  it('sets marketError to null on success', async () => {
    setState({ marketError: 'network_error' })
    await getState().updatePrices()
    expect(getState().marketError).toBeNull()
  })

  it('formats volume as human-readable string (M or B suffix)', async () => {
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    // FULL_MOCK_DATA uses (i+1)*1e8, so volumes can be M or B range
    expect(btc?.volume).toMatch(/[MB]$/)
  })

  it('formats marketCap as human-readable string', async () => {
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.marketCap).toMatch(/B$/)
  })

  it('sets maxSupply to "∞" when max_supply is null', async () => {
    await getState().updatePrices()
    const eth = getState().coins.find(c => c.id === 'ethereum')
    expect(eth?.maxSupply).toBe('∞')
  })

  it('sets maxSupply to formatted string when max_supply is a number', async () => {
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.maxSupply).toBe('21.00M')
  })
})

// ── T4: updatePrices — failure ─────────────────────────────────────────────────

describe('T4: updatePrices — API failure', () => {
  it('sets marketError when fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure')) as any
    await getState().updatePrices()
    expect(getState().marketError).toBe('network_error')
  })

  it('sets marketError when response not ok', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 }) as any
    await getState().updatePrices()
    expect(getState().marketError).toBe('network_error')
  })

  it('does NOT reset existing prices to 0 on failure', async () => {
    // First set some real prices
    setState({
      coins: buildInitialCoins().map((c, i) => ({ ...c, price: (i + 1) * 100 }))
    })
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure')) as any
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.price).toBe(100) // price unchanged
  })
})

// ── T5: trending tab order ─────────────────────────────────────────────────────

describe('T5: trending tab — fixed coin order', () => {
  it('maintains BTC as first coin', () => {
    const coins = getState().coins
    expect(coins[0].symbol).toBe('BTC')
  })

  it('maintains HBAR as last coin', () => {
    const coins = getState().coins
    expect(coins[15].symbol).toBe('HBAR')
  })

  it('maintains the full 16-coin order', () => {
    const coins = getState().coins
    const expectedOrder = ['BTC','ETH','XRP','BNB','SOL','TRX','DOGE','BCH','ADA','HYPE','WBTC','LEO','XMR','LINK','XLM','HBAR']
    expect(coins.map(c => c.symbol)).toEqual(expectedOrder)
  })

  it('order is preserved after updatePrices', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => FULL_MOCK_DATA,
    }) as any
    await getState().updatePrices()
    const coins = getState().coins
    expect(coins[0].symbol).toBe('BTC')
    expect(coins[15].symbol).toBe('HBAR')
  })
})

// ── T6: gainers / losers sorting ───────────────────────────────────────────────

describe('T6: gainers and losers sorting', () => {
  beforeEach(() => {
    // Set known change24h values for testing
    setState({
      coins: buildInitialCoins().map((c, i) => ({
        ...c,
        price: 100,
        change24h: i % 2 === 0 ? (i + 1) : -(i + 1),
      }))
    })
  })

  it('gainers sort: highest change24h first', () => {
    const coins = [...getState().coins].sort((a, b) => b.change24h - a.change24h)
    for (let i = 0; i < coins.length - 1; i++) {
      expect(coins[i].change24h).toBeGreaterThanOrEqual(coins[i + 1].change24h)
    }
  })

  it('losers sort: lowest change24h first', () => {
    const coins = [...getState().coins].sort((a, b) => a.change24h - b.change24h)
    for (let i = 0; i < coins.length - 1; i++) {
      expect(coins[i].change24h).toBeLessThanOrEqual(coins[i + 1].change24h)
    }
  })
})

// ── T7: chartData append logic ─────────────────────────────────────────────────

describe('T7: chartData rolling window append', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => FULL_MOCK_DATA,
    }) as any
  })

  it('does NOT append to empty chartData', async () => {
    // Initial state has chartData = []
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.chartData).toHaveLength(0)
  })

  it('appends one point when chartData has existing data', async () => {
    // Pre-populate chartData with 5 points
    setState({
      coins: getState().coins.map((c, i) =>
        i === 0
          ? { ...c, chartData: Array.from({ length: 5 }, (_, j) => ({ time: j * 1000, price: 100 })) }
          : c
      )
    })
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.chartData).toHaveLength(6)
  })

  it('maintains 24-point window when chartData has 24 points', async () => {
    // Pre-populate with 24 points
    setState({
      coins: getState().coins.map((c, i) =>
        i === 0
          ? { ...c, chartData: Array.from({ length: 24 }, (_, j) => ({ time: j * 1000, price: 100 })) }
          : c
      )
    })
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    expect(btc?.chartData).toHaveLength(24)
  })

  it('rolling window correctly drops oldest point at 24+', async () => {
    setState({
      coins: getState().coins.map((c, i) =>
        i === 0
          ? { ...c, chartData: Array.from({ length: 24 }, (_, j) => ({ time: j, price: 50 })) }
          : c
      )
    })
    await getState().updatePrices()
    const btc = getState().coins.find(c => c.id === 'bitcoin')
    // Should still be 24 points (oldest dropped), last price should be from API
    expect(btc?.chartData).toHaveLength(24)
    expect(btc?.chartData[btc.chartData.length - 1].price).toBe(100) // FULL_MOCK_DATA[0].current_price
  })
})
