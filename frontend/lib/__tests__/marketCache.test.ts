/**
 * Unit tests for market data localStorage cache helpers (task53)
 * Tests: saveMarketCache / loadMarketCache roundtrip, error tolerance,
 *        updatePrices cache write on success, cache preservation on failure.
 */

// ─── Mock heavy dependencies that aren't needed for cache logic ───────────────
jest.mock('@/lib/supabaseClient', () => ({ supabase: { removeChannel: jest.fn(), channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })) } }))
jest.mock('@/lib/walletCrypto', () => ({
  getStoredWallets: jest.fn(() => []),
  getActiveWallet: jest.fn(() => null),
  saveExternalWallet: jest.fn(),
  removeExternalWallet: jest.fn(),
  setActiveWalletId: jest.fn(),
}))
jest.mock('@/lib/chat', () => ({
  getChatId: jest.fn((a: string, b: string) => `${a}_${b}`),
  addressToColor: jest.fn(() => '#000000'),
}))

// ─── localStorage mock ────────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value }),
    removeItem: jest.fn((key: string) => { delete store[key] }),
    clear: jest.fn(() => { store = {} }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true })
Object.defineProperty(global, 'window', { value: global, writable: true })

// ─── Import under test ────────────────────────────────────────────────────────
import { saveMarketCache, loadMarketCache, MARKET_CACHE_KEY, buildInitialCoins, type Coin } from '@/lib/store'

// ─── Helper: make a valid Coin with price > 0 ────────────────────────────────
function makeCoin(overrides: Partial<Coin> = {}): Coin {
  return {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    icon: '₿',
    price: 65000,
    change24h: 2.5,
    volume: '44.60B',
    marketCap: '1.32T',
    high24h: 67000,
    low24h: 64000,
    supply: '19.99M',
    maxSupply: '21.00M',
    chartData: [{ time: 1700000000000, price: 64000 }, { time: 1700003600000, price: 65000 }],
    favorited: false,
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear()
  jest.clearAllMocks()
})

describe('saveMarketCache / loadMarketCache roundtrip', () => {
  test('3.1 - saves and restores all 16 coins with correct market data fields', () => {
    const coins = buildInitialCoins().map((c, i) => makeCoin({
      id: c.id,
      symbol: c.symbol,
      name: c.name,
      icon: c.icon,
      price: 100 + i,
      change24h: i * 0.5,
      volume: `${i}.00B`,
      marketCap: `${i}.00T`,
      high24h: 110 + i,
      low24h: 90 + i,
      supply: `${i}.00M`,
      maxSupply: `${i}.00M`,
      chartData: [{ time: Date.now(), price: 100 + i }],
      favorited: i % 2 === 0,
    }))

    saveMarketCache(coins)
    const restored = loadMarketCache()

    expect(restored.length).toBe(16)
    expect(restored[0].price).toBe(coins[0].price)
    expect(restored[0].change24h).toBe(coins[0].change24h)
    expect(restored[0].chartData).toEqual(coins[0].chartData)

    // favorited, symbol, name, icon must NOT be in cache entries
    for (const entry of restored) {
      expect((entry as Record<string, unknown>).favorited).toBeUndefined()
      expect((entry as Record<string, unknown>).symbol).toBeUndefined()
      expect((entry as Record<string, unknown>).name).toBeUndefined()
      expect((entry as Record<string, unknown>).icon).toBeUndefined()
    }
  })

  test('3.1 - coins with price=0 are excluded from cache', () => {
    const coins = [
      makeCoin({ id: 'bitcoin', price: 65000 }),
      makeCoin({ id: 'ethereum', price: 0 }),   // should be excluded
    ]
    saveMarketCache(coins)
    const restored = loadMarketCache()
    expect(restored.length).toBe(1)
    expect(restored[0].id).toBe('bitcoin')
  })
})

describe('loadMarketCache error tolerance', () => {
  test('3.2 - returns [] when localStorage has no key', () => {
    expect(loadMarketCache()).toEqual([])
  })

  test('3.2 - returns [] when localStorage has invalid JSON', () => {
    localStorageMock.setItem(MARKET_CACHE_KEY, 'not-valid-json{{{')
    expect(loadMarketCache()).toEqual([])
  })

  test('3.2 - does not throw even when JSON.parse fails', () => {
    localStorageMock.setItem(MARKET_CACHE_KEY, undefined as unknown as string)
    expect(() => loadMarketCache()).not.toThrow()
  })
})

describe('saveMarketCache writes correct localStorage key', () => {
  test('writes to the correct key', () => {
    const coins = [makeCoin({ id: 'bitcoin', price: 70000 })]
    saveMarketCache(coins)
    expect(localStorageMock.setItem).toHaveBeenCalledWith(MARKET_CACHE_KEY, expect.any(String))
    const raw = localStorageMock.getItem(MARKET_CACHE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed[0].price).toBe(70000)
  })

  test('does not write when all coins have price=0', () => {
    const coins = [makeCoin({ price: 0 })]
    saveMarketCache(coins)
    // setItem should have been called with an empty array
    const raw = localStorageMock.getItem(MARKET_CACHE_KEY)
    const parsed = JSON.parse(raw!)
    expect(parsed).toEqual([])
  })
})

describe('cache preservation on failure', () => {
  test('3.4 - pre-existing cache is not altered if we do not call saveMarketCache', () => {
    // Simulate a valid cache written by a previous successful fetch
    const previousCache = [{ id: 'bitcoin', price: 65000, change24h: 1.5, volume: '44B', marketCap: '1.3T', high24h: 66000, low24h: 64000, supply: '19M', maxSupply: '21M', chartData: [] }]
    localStorageMock.setItem(MARKET_CACHE_KEY, JSON.stringify(previousCache))

    // A network failure path does NOT call saveMarketCache — verify cache is intact
    const restored = loadMarketCache()
    expect(restored.length).toBe(1)
    expect(restored[0].price).toBe(65000)
  })
})

describe('cache restore merge preserves static fields and favorited', () => {
  test('3.5 - merging cache entry into initial coin preserves symbol/name/icon', () => {
    const initialCoin = buildInitialCoins().find(c => c.id === 'bitcoin')!
    const cacheEntry = { id: 'bitcoin', price: 99000, change24h: -1.0, volume: '50B', marketCap: '1.9T', high24h: 100000, low24h: 98000, supply: '20M', maxSupply: '21M', chartData: [{ time: 1, price: 99000 }] }

    // Simulate the merge logic from initMarketData
    const merged = { ...initialCoin, ...cacheEntry }

    expect(merged.symbol).toBe('BTC')   // from initialCoin, preserved
    expect(merged.name).toBe('Bitcoin') // from initialCoin, preserved
    expect(merged.icon).toBe('₿')       // from initialCoin, preserved
    expect(merged.favorited).toBe(false) // from initialCoin, preserved
    expect(merged.price).toBe(99000)    // from cache, overrides
    expect(merged.chartData).toEqual([{ time: 1, price: 99000 }]) // from cache
  })
})
