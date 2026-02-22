/**
 * Unit tests for frontend/lib/chat.ts
 * Tests: getChatId, addressToColor, sendFriendRequest, fetchPendingRequests
 */

// ── Supabase mock factory ─────────────────────────────────────────────────────
// We need a fresh chainable builder per test so that `then` is writable.

function makeChain(resolveValue: any) {
  const upsertMock = jest.fn()
  const selectMock = jest.fn()
  const eqMock = jest.fn()
  const orderMock = jest.fn()

  // The chain must be a plain object (not inherited from chain) so properties are writable
  const c: any = {
    _resolveValue: resolveValue,
    _upsertMock: upsertMock,
    _selectMock: selectMock,
    _eqMock: eqMock,
    _orderMock: orderMock,
  }

  c.select = (...args: any[]) => { selectMock(...args); return c }
  c.insert = (...args: any[]) => c
  c.upsert = (...args: any[]) => { upsertMock(...args); return c }
  c.update = (...args: any[]) => c
  c.eq = (...args: any[]) => { eqMock(...args); return c }
  c.order = (...args: any[]) => { orderMock(...args); return c }
  c.limit = (...args: any[]) => c
  c.in = (...args: any[]) => c
  c.or = (...args: any[]) => c
  c.contains = (...args: any[]) => c
  c.single = () => Promise.resolve(resolveValue)
  // Make the chain itself awaitable (for `await supabase.from(...).upsert(...)`)
  c.then = (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject)

  return c
}

// The mock supabase client — `from` will be overridden per test
const mockSupabaseClient: any = {
  from: jest.fn(),
  channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
  removeChannel: jest.fn(),
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}))

jest.mock('../supabaseClient', () => ({
  supabase: mockSupabaseClient,
  getChatId: (addrA: string, addrB: string) =>
    [addrA.toLowerCase(), addrB.toLowerCase()].sort().join('_'),
}))

import { getChatId, addressToColor, sendFriendRequest, fetchPendingRequests } from '../chat'

beforeEach(() => {
  jest.clearAllMocks()
})

// ── T1 & T2: getChatId ───────────────────────────────────────────────────────
describe('getChatId', () => {
  const A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  const B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'

  test('T1: bidirectionally consistent — getChatId(A,B) === getChatId(B,A)', () => {
    expect(getChatId(A, B)).toBe(getChatId(B, A))
  })

  test('T2: result is lowercase', () => {
    const id = getChatId(A, B)
    expect(id).toBe(id.toLowerCase())
  })
})

// ── T3: addressToColor ───────────────────────────────────────────────────────
describe('addressToColor', () => {
  const ADDR = '0x1234567890123456789012345678901234567890'

  test('T3: same address always returns the same color', () => {
    expect(addressToColor(ADDR)).toBe(addressToColor(ADDR))
  })

  test('T3b: returns a hex color string', () => {
    expect(addressToColor(ADDR)).toMatch(/^#[0-9a-fA-F]{6}$/)
  })
})

// ── T4: sendFriendRequest ────────────────────────────────────────────────────
describe('sendFriendRequest', () => {
  test('T4: calls supabase.from("contacts").upsert with correct fields', async () => {
    const chain = makeChain({ data: null, error: null })
    mockSupabaseClient.from.mockReturnValue(chain)

    await sendFriendRequest(
      '0xAAAA000000000000000000000000000000000001',
      '0xBBBB000000000000000000000000000000000002',
      'hello'
    )

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('contacts')
    expect(chain._upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        wallet_a: '0xaaaa000000000000000000000000000000000001',
        wallet_b: '0xbbbb000000000000000000000000000000000002',
        status: 'pending',
        request_msg: 'hello',
      }),
      expect.objectContaining({
        onConflict: 'wallet_a,wallet_b',
        ignoreDuplicates: true,
      })
    )
  })
})

// ── T5: fetchPendingRequests ─────────────────────────────────────────────────
describe('fetchPendingRequests', () => {
  test('T5: queries contacts with wallet_b=myAddress and status=pending', async () => {
    const MY_ADDRESS = '0x1234000000000000000000000000000012340000'
    const chain = makeChain({ data: [], error: null })
    mockSupabaseClient.from.mockReturnValue(chain)

    await fetchPendingRequests(MY_ADDRESS)

    expect(mockSupabaseClient.from).toHaveBeenCalledWith('contacts')
    expect(chain._selectMock).toHaveBeenCalledWith('*')
    expect(chain._eqMock).toHaveBeenCalledWith('wallet_b', MY_ADDRESS.toLowerCase())
    expect(chain._eqMock).toHaveBeenCalledWith('status', 'pending')
  })
})
