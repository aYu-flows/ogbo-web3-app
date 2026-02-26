/**
 * Unit tests for copyToClipboard utility
 * Runs in node environment — window/navigator/document are mocked manually.
 */

// Set up global window/navigator/document mocks before importing the module
const mockWrite = jest.fn()
const mockWriteText = jest.fn()
const mockExecCommand = jest.fn()
const mockAppendChild = jest.fn()
const mockRemoveChild = jest.fn()
const mockFocus = jest.fn()
const mockSelect = jest.fn()

// Minimal textarea mock
const mockTextarea = {
  value: '',
  style: { cssText: '' },
  focus: mockFocus,
  select: mockSelect,
}

// Set up globals
;(global as any).window = {
  isSecureContext: false,
}
;(global as any).navigator = {}
;(global as any).document = {
  createElement: jest.fn().mockReturnValue(mockTextarea),
  body: {
    appendChild: mockAppendChild,
    removeChild: mockRemoveChild,
  },
  execCommand: mockExecCommand,
}

// Mock @capacitor/clipboard
jest.mock('@capacitor/clipboard', () => ({ Clipboard: { write: mockWrite } }), { virtual: true })

// Import after globals are set
import { copyToClipboard } from '../utils'

describe('copyToClipboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset to no Capacitor, no clipboard, non-secure by default
    delete (global as any).window.Capacitor
    ;(global as any).window.isSecureContext = false
    ;(global as any).navigator.clipboard = undefined
    mockExecCommand.mockReturnValue(true)
  })

  // ── Tier 1: Capacitor path ──────────────────────────────────────────────────
  it('calls Capacitor Clipboard.write when window.Capacitor is present', async () => {
    ;(global as any).window.Capacitor = { isNativePlatform: () => true }
    mockWrite.mockResolvedValue(undefined)

    await copyToClipboard('hello')

    expect(mockWrite).toHaveBeenCalledWith({ string: 'hello' })
  })

  // ── Tier 2: Web Clipboard API path ─────────────────────────────────────────
  it('calls navigator.clipboard.writeText when secure context and no Capacitor', async () => {
    ;(global as any).window.isSecureContext = true
    ;(global as any).navigator.clipboard = { writeText: mockWriteText }
    mockWriteText.mockResolvedValue(undefined)

    await copyToClipboard('world')

    expect(mockWriteText).toHaveBeenCalledWith('world')
    expect(mockWrite).not.toHaveBeenCalled()
  })

  // ── Tier 3: execCommand fallback ────────────────────────────────────────────
  it('uses execCommand fallback when clipboard API is unavailable', async () => {
    await copyToClipboard('fallback text')

    expect(mockExecCommand).toHaveBeenCalledWith('copy')
    expect(mockTextarea.value).toBe('fallback text')
  })

  // ── Error: execCommand returns false ───────────────────────────────────────
  it('throws when execCommand returns false', async () => {
    mockExecCommand.mockReturnValue(false)

    await expect(copyToClipboard('fail')).rejects.toThrow('execCommand failed')
  })

  // ── Edge case: empty string ─────────────────────────────────────────────────
  it('does not throw when copying an empty string via execCommand', async () => {
    await expect(copyToClipboard('')).resolves.toBeUndefined()
    expect(mockTextarea.value).toBe('')
  })
})
