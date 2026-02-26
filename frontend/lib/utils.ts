import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Cross-platform clipboard write utility.
 * Three-tier fallback: Capacitor native → Web Clipboard API → execCommand legacy.
 * Throws on failure so callers can show an error toast.
 */
export async function copyToClipboard(text: string): Promise<void> {
  // Tier 1: Capacitor native (Android / iOS)
  if (typeof window !== 'undefined' && !!(window as any).Capacitor) {
    const { Clipboard } = await import('@capacitor/clipboard')
    await Clipboard.write({ string: text })
    return
  }
  // Tier 2: Web Clipboard API (secure context only)
  if (typeof navigator !== 'undefined' && navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Tier 3: execCommand fallback (non-secure context / old browsers)
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;opacity:0;top:-9999px;left:-9999px'
  document.body.appendChild(ta)
  ta.focus()
  ta.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(ta)
  if (!ok) throw new Error('copyToClipboard: execCommand failed')
}
