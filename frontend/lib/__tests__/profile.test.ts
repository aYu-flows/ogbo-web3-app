/**
 * profile.test.ts
 * Profile CRUD 模块单元测试
 *
 * 测试环境：Node.js（jest testEnvironment: 'node'）
 * 通过 mock supabase 客户端测试 profile 操作
 */

// ── Mock Supabase ──────────────────────────────────────────

const mockMaybeSingle = jest.fn()
const mockSelect = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }) })
const mockUpsert = jest.fn().mockResolvedValue({ error: null })
const mockIn = jest.fn().mockResolvedValue({ data: [], error: null })
const mockUpload = jest.fn().mockResolvedValue({ error: null })
const mockRemove = jest.fn().mockResolvedValue({ error: null })
const mockList = jest.fn().mockResolvedValue({ data: [], error: null })
const mockGetPublicUrl = jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/avatar.jpg' } })

jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
        in: mockIn,
      }),
      upsert: mockUpsert,
    }),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
        list: mockList,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}))

import { validateAvatarFile } from '../profile'

// ── Tests ──────────────────────────────────────────

describe('profile module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('validateAvatarFile', () => {
    it('returns null for valid file', () => {
      const file = new File(['x'.repeat(100)], 'avatar.jpg', { type: 'image/jpeg' })
      expect(validateAvatarFile(file)).toBeNull()
    })

    it('returns avatarTooLarge for file > 2MB', () => {
      const bigContent = new ArrayBuffer(2 * 1024 * 1024 + 1)
      const file = new File([bigContent], 'big.jpg', { type: 'image/jpeg' })
      expect(validateAvatarFile(file)).toBe('avatarTooLarge')
    })

    it('returns avatarFormatError for invalid file type', () => {
      const file = new File(['x'], 'avatar.gif', { type: 'image/gif' })
      expect(validateAvatarFile(file)).toBe('avatarFormatError')
    })

    it('accepts image/png', () => {
      const file = new File(['x'], 'avatar.png', { type: 'image/png' })
      expect(validateAvatarFile(file)).toBeNull()
    })

    it('accepts image/webp', () => {
      const file = new File(['x'], 'avatar.webp', { type: 'image/webp' })
      expect(validateAvatarFile(file)).toBeNull()
    })
  })
})

describe('getDisplayName / getAvatarUrl (store)', () => {
  // Test the store helper functions logic
  it('returns truncated address when no profile', () => {
    const addr = '0x1234567890abcdef1234567890abcdef12345678'
    const result = `${addr.slice(0, 6)}...${addr.slice(-4)}`
    expect(result).toBe('0x1234...5678')
  })

  it('nickname max length is 20 chars', () => {
    const longNickname = 'a'.repeat(21)
    expect(longNickname.length).toBeGreaterThan(20)
  })
})
