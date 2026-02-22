/**
 * Push Protocol Remote Debug Logger
 *
 * Sends structured debug logs to Supabase for remote diagnosis.
 * Silently no-ops when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not configured,
 * so it is safe to ship in production builds without those env vars set.
 *
 * Usage:
 *   import { createPushLogger, getPushLogger } from '@/lib/debugLogger'
 *   const logger = createPushLogger(walletAddress, 'prod')  // in store.ts initPush
 *   logger.log('push_init_start', 'started')
 *   // In push.ts: getPushLogger()?.log('push_api_initialize', 'OK')
 */

interface LogPayload {
  wallet: string
  session_id: string
  push_env: string
  step: string
  level: 'info' | 'error'
  message: string
  error_code?: string
  error_msg?: string
  extra?: Record<string, unknown>
}

class PushDebugLogger {
  private readonly wallet: string
  private readonly sessionId: string
  private readonly pushEnv: string

  constructor(wallet: string, pushEnv: string) {
    this.wallet = wallet
    this.pushEnv = pushEnv
    // Session ID: first 8 chars of wallet + underscore + timestamp (distinguishes each initPush attempt)
    this.sessionId = `${wallet.slice(0, 8)}_${Date.now()}`
  }

  /** Record an info-level log entry. Fire-and-forget — never blocks, never throws. */
  log(step: string, message: string, extra?: Record<string, unknown>): void {
    this.send({ level: 'info', step, message, extra })
  }

  /**
   * Record an error-level log entry. Fire-and-forget — never blocks, never throws.
   * Extracts code, message, stack from errorObj if provided.
   */
  error(step: string, message: string, errorObj?: unknown, extra?: Record<string, unknown>): void {
    const e = errorObj as Record<string, unknown> | null | undefined
    const errorCode = e?.code !== undefined && e?.code !== null ? String(e.code) : undefined
    const errorMsg = typeof e?.message === 'string' ? e.message : (errorObj != null ? String(errorObj) : undefined)
    const stack = typeof e?.stack === 'string' ? e.stack : undefined
    const mergedExtra: Record<string, unknown> = { ...(extra ?? {}) }
    if (stack) mergedExtra.stack = stack

    this.send({
      level: 'error',
      step,
      message,
      error_code: errorCode,
      error_msg: errorMsg,
      extra: Object.keys(mergedExtra).length > 0 ? mergedExtra : undefined,
    })
  }

  private send(entry: Omit<LogPayload, 'wallet' | 'session_id' | 'push_env'>): void {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    // Silently degrade when not configured
    if (!supabaseUrl || !supabaseKey) return

    const payload: LogPayload = {
      wallet: this.wallet,
      session_id: this.sessionId,
      push_env: this.pushEnv,
      ...entry,
    }

    // Fire-and-forget: never await, never let errors propagate
    fetch(`${supabaseUrl}/rest/v1/push_debug_logs`, {
      method: 'POST',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Intentionally swallow all errors — this is a non-critical diagnostic tool
    })
  }

  /** Expose sessionId for test assertions */
  getSessionId(): string {
    return this.sessionId
  }

  /** Expose wallet for test assertions */
  getWallet(): string {
    return this.wallet
  }
}

// Module-level singleton — shared across all imports of this module
let _currentLogger: PushDebugLogger | null = null

/**
 * Create (or replace) the current module-level logger.
 * Call this at the start of each initPush attempt so each retry gets a fresh session_id.
 */
export function createPushLogger(wallet: string, pushEnv: string): PushDebugLogger {
  _currentLogger = new PushDebugLogger(wallet, pushEnv)
  return _currentLogger
}

/**
 * Get the current logger singleton.
 * Returns null if createPushLogger has not yet been called (safe to use with optional chaining).
 */
export function getPushLogger(): PushDebugLogger | null {
  return _currentLogger
}

/** Reset the singleton (used in tests). */
export function _resetLoggerForTest(): void {
  _currentLogger = null
}
