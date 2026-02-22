/**
 * Unit tests for frontend/lib/debugLogger.ts
 * Tests T1-T7 as specified in task37-remote-logging-impl.md §四
 */

import { createPushLogger, getPushLogger, _resetLoggerForTest } from '../debugLogger'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPABASE_URL = 'https://test.supabase.co'
const SUPABASE_KEY = 'test-anon-key'

/** Set both Supabase env vars */
function setEnv() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = SUPABASE_KEY
}

/** Clear both Supabase env vars */
function clearEnv() {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
}

/** Extract the JSON body from the mock fetch call */
function getLastFetchBody(): Record<string, unknown> {
  const mock = global.fetch as jest.MockedFunction<typeof fetch>
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1]
  return JSON.parse(lastCall[1]?.body as string)
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset singleton before each test
  _resetLoggerForTest()
  // Mock fetch
  global.fetch = jest.fn().mockResolvedValue({ ok: true } as Response)
})

afterEach(() => {
  clearEnv()
  jest.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// T1: createPushLogger returns the logger and getPushLogger returns same ref
// ---------------------------------------------------------------------------
test('T1: createPushLogger initialises singleton; getPushLogger returns same reference', () => {
  setEnv()
  const logger = createPushLogger('0xABCD1234ABCD1234ABCD', 'prod')

  expect(logger).not.toBeNull()
  expect(getPushLogger()).toBe(logger)
})

// ---------------------------------------------------------------------------
// T2: session_id starts with first 8 chars of wallet and contains underscore
// ---------------------------------------------------------------------------
test('T2: session_id is prefixed with first 8 chars of wallet and separated by underscore', async () => {
  setEnv()
  const wallet = '0xABCD1234ABCD1234ABCD1234'
  const logger = createPushLogger(wallet, 'prod')

  logger.log('test_step', 'test message')

  // Let the microtask queue flush so the mocked fetch promise resolves
  await Promise.resolve()

  const body = getLastFetchBody()
  const sessionId = body.session_id as string

  expect(sessionId).toMatch(/^0xABCD12_\d+$/)
  expect(sessionId.startsWith(wallet.slice(0, 8))).toBe(true)
  expect(sessionId).toContain('_')
})

// ---------------------------------------------------------------------------
// T3: log() sends correct payload (level=info, step, extra)
// ---------------------------------------------------------------------------
test('T3: log() sends correct payload with level=info, step, and extra fields', async () => {
  setEnv()
  const logger = createPushLogger('0xWallet001', 'prod')

  logger.log('push_init_start', 'initPush started', { pushEnv: 'prod' })
  await Promise.resolve()

  expect(global.fetch).toHaveBeenCalledTimes(1)

  const [url, options] = (global.fetch as jest.Mock).mock.calls[0]
  expect(url).toContain('/rest/v1/push_debug_logs')

  const body = getLastFetchBody()
  expect(body.level).toBe('info')
  expect(body.step).toBe('push_init_start')
  expect(body.message).toBe('initPush started')
  expect((body.extra as Record<string, unknown>)?.pushEnv).toBe('prod')
  expect(body.wallet).toBe('0xWallet001')
  expect(body.push_env).toBe('prod')

  // Check Authorization header
  const headers = options?.headers as Record<string, string>
  expect(headers?.['Authorization']).toBe(`Bearer ${SUPABASE_KEY}`)
  expect(headers?.['apikey']).toBe(SUPABASE_KEY)
})

// ---------------------------------------------------------------------------
// T4: error() correctly extracts error_msg, error_code (as string)
// ---------------------------------------------------------------------------
test('T4: error() extracts level=error, error_msg, and error_code as string', async () => {
  setEnv()
  const logger = createPushLogger('0xWallet002', 'staging')

  const errorObj = { message: 'network error', code: 'ERR_NET_CHANGED' }
  logger.error('push_api_initialize', 'PushAPI.initialize FAILED', errorObj)
  await Promise.resolve()

  const body = getLastFetchBody()
  expect(body.level).toBe('error')
  expect(body.step).toBe('push_api_initialize')
  expect(body.error_msg).toBe('network error')
  expect(body.error_code).toBe('ERR_NET_CHANGED')
  expect(typeof body.error_code).toBe('string')
})

test('T4b: error() coerces numeric error_code to string', async () => {
  setEnv()
  const logger = createPushLogger('0xWallet003', 'prod')

  logger.error('push_init_stream', 'failed', { message: 'timeout', code: 408 })
  await Promise.resolve()

  const body = getLastFetchBody()
  expect(body.error_code).toBe('408')
  expect(typeof body.error_code).toBe('string')
})

// ---------------------------------------------------------------------------
// T5: When env vars are not configured, fetch is NOT called
// ---------------------------------------------------------------------------
test('T5: fetch is not called when Supabase env vars are not configured', async () => {
  clearEnv() // ensure env vars absent
  const logger = createPushLogger('0xWallet004', 'prod')

  logger.log('push_init_start', 'test message')
  await Promise.resolve()

  expect(global.fetch).not.toHaveBeenCalled()
})

test('T5b: fetch not called when only URL is set (key missing)', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const logger = createPushLogger('0xWallet005', 'prod')
  logger.log('any_step', 'msg')
  await Promise.resolve()

  expect(global.fetch).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// T6: fetch failure does not propagate (no uncaught error)
// ---------------------------------------------------------------------------
test('T6: fetch rejection is swallowed and does not throw', async () => {
  setEnv()
  ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network down'))

  const logger = createPushLogger('0xWallet006', 'prod')

  // Should not throw
  expect(() => {
    logger.log('test_step', 'message')
  }).not.toThrow()

  // Let the rejection propagate through the microtask queue; still no uncaught error
  await new Promise((r) => setTimeout(r, 10))
})

// ---------------------------------------------------------------------------
// T7: Two createPushLogger calls produce distinct session_ids; getPushLogger returns latest
// ---------------------------------------------------------------------------
test('T7: multiple createPushLogger calls produce distinct session_ids; getPushLogger returns latest', async () => {
  setEnv()

  const logger1 = createPushLogger('0xWallet1111', 'prod')
  const sessionId1 = logger1.getSessionId()

  // Small delay to guarantee a different timestamp
  await new Promise((r) => setTimeout(r, 5))

  const logger2 = createPushLogger('0xWallet2222', 'staging')
  const sessionId2 = logger2.getSessionId()

  expect(sessionId1).not.toBe(sessionId2)
  expect(getPushLogger()).toBe(logger2)
  expect(getPushLogger()?.getWallet()).toBe('0xWallet2222')
})
