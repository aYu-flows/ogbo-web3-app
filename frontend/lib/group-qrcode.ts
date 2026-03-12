const BASE_URL = 'https://ogbox-web3-app.vercel.app'

/**
 * Generate a full invite URL from a token.
 */
export function generateInviteUrl(token: string): string {
  return `${BASE_URL}/group/join?token=${encodeURIComponent(token)}`
}

/**
 * Extract an invite token from a URL or return the raw token if it's not a URL.
 * Returns null if input is empty or invalid.
 */
export function parseInviteToken(urlOrToken: string): string | null {
  if (!urlOrToken || !urlOrToken.trim()) return null

  const trimmed = urlOrToken.trim()

  // Try parsing as URL
  try {
    const url = new URL(trimmed)
    const token = url.searchParams.get('token')
    if (token) return token
  } catch {
    // Not a URL — treat as raw token
  }

  // If it looks like a UUID (raw token), return as-is
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return trimmed
  }

  // Could also be a partial URL like "ogbox-web3-app.vercel.app/group/join?token=xxx"
  try {
    const url = new URL(`https://${trimmed}`)
    const token = url.searchParams.get('token')
    if (token) return token
  } catch {
    // Not a valid URL either
  }

  return null
}
