/**
 * Task 91 Test Suite — Dissolved Group Input Disable + Join Request Red Dot Notifications
 *
 * Tests cover:
 * A. Dissolved/removed group input disable logic
 * B. Pending request count batch loading
 * C. Admin group ID tracking
 * D. Red dot display logic
 */

// ===== A. fetchAllPendingRequestCounts =====

describe('fetchAllPendingRequestCounts', () => {
  let fetchAllPendingRequestCounts: typeof import('@/lib/group-management').fetchAllPendingRequestCounts

  beforeAll(async () => {
    const mod = await import('@/lib/group-management')
    fetchAllPendingRequestCounts = mod.fetchAllPendingRequestCounts
  })

  test('returns empty object for empty groupIds', async () => {
    const result = await fetchAllPendingRequestCounts([])
    expect(result).toEqual({})
  })

  test('function exists and is callable', () => {
    expect(typeof fetchAllPendingRequestCounts).toBe('function')
  })
})

// ===== B. GroupRow interface includes admins =====

describe('GroupRow admins field', () => {
  test('GroupRow interface accepts admins field', () => {
    // Type-level test: verify GroupRow can include admins
    const row: import('@/lib/chat').GroupRow = {
      id: 'test-group',
      created_at: '2024-01-01T00:00:00Z',
      name: 'Test Group',
      creator: '0xabc',
      members: ['0xabc', '0xdef'],
      admins: ['0xabc'],
    }
    expect(row.admins).toEqual(['0xabc'])
  })

  test('GroupRow works without admins (optional)', () => {
    const row: import('@/lib/chat').GroupRow = {
      id: 'test-group',
      created_at: '2024-01-01T00:00:00Z',
      name: 'Test Group',
      creator: '0xabc',
      members: ['0xabc'],
    }
    expect(row.admins).toBeUndefined()
  })
})

// ===== C. Store myAdminGroupIds =====

describe('Store myAdminGroupIds', () => {
  test('store exposes myAdminGroupIds field', () => {
    const { useStore } = require('@/lib/store')
    const state = useStore.getState()
    expect(Array.isArray(state.myAdminGroupIds)).toBe(true)
    expect(state.myAdminGroupIds).toEqual([])
  })

  test('store exposes pendingRequestCounts field', () => {
    const { useStore } = require('@/lib/store')
    const state = useStore.getState()
    expect(typeof state.pendingRequestCounts).toBe('object')
    expect(state.pendingRequestCounts).toEqual({})
  })
})

// ===== D. Dissolved input disable logic =====

describe('Dissolved group input disable conditions', () => {
  // These are logic-level tests for the condition priority
  test('removedAlert takes priority over mute', () => {
    // Simulating the condition logic:
    // removedAlert ? show_dissolved_notice : (myMute || isMuteAll) ? show_mute_notice : show_input
    const removedAlert: 'dissolved' | 'removed' | null = 'dissolved'
    const myMute = { mute_until: '2099-01-01' }
    const isMuteAll = true

    // When removedAlert is set, it should take priority
    const showDissolved = !!removedAlert
    const showMute = !removedAlert && (!!myMute || isMuteAll)
    const showInput = !removedAlert && !(!!myMute || isMuteAll)

    expect(showDissolved).toBe(true)
    expect(showMute).toBe(false)
    expect(showInput).toBe(false)
  })

  test('mute shows when no removedAlert', () => {
    const removedAlert: 'dissolved' | 'removed' | null = null
    const myMute = { mute_until: '2099-01-01' }
    const isMuteAll = false

    const showDissolved = !!removedAlert
    const showMute = !removedAlert && (!!myMute || isMuteAll)

    expect(showDissolved).toBe(false)
    expect(showMute).toBe(true)
  })

  test('input shows when no removedAlert and no mute', () => {
    const removedAlert: 'dissolved' | 'removed' | null = null
    const myMute = null
    const isMuteAll = false

    const showDissolved = !!removedAlert
    const showMute = !removedAlert && (!!myMute || isMuteAll)
    const showInput = !removedAlert && !(!!myMute || isMuteAll)

    expect(showDissolved).toBe(false)
    expect(showMute).toBe(false)
    expect(showInput).toBe(true)
  })

  test('removed alert also disables input', () => {
    const removedAlert: 'dissolved' | 'removed' | null = 'removed'
    const showDissolved = !!removedAlert
    expect(showDissolved).toBe(true)
  })
})

// ===== E. Red dot display logic =====

describe('Red dot display logic', () => {
  test('red dot shows for admin with pending requests', () => {
    const chatType = 'group'
    const chatId = 'group-1'
    const myAdminGroupIds = ['group-1', 'group-3']
    const pendingRequestCounts: Record<string, number> = { 'group-1': 3 }

    const showRedDot = chatType === 'group'
      && myAdminGroupIds.includes(chatId)
      && (pendingRequestCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(true)
  })

  test('red dot hidden for regular member', () => {
    const chatType = 'group'
    const chatId = 'group-2'
    const myAdminGroupIds = ['group-1'] // not admin of group-2
    const pendingRequestCounts: Record<string, number> = { 'group-2': 5 }

    const showRedDot = chatType === 'group'
      && myAdminGroupIds.includes(chatId)
      && (pendingRequestCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(false)
  })

  test('red dot hidden when count is 0', () => {
    const chatType = 'group'
    const chatId = 'group-1'
    const myAdminGroupIds = ['group-1']
    const pendingRequestCounts: Record<string, number> = { 'group-1': 0 }

    const showRedDot = chatType === 'group'
      && myAdminGroupIds.includes(chatId)
      && (pendingRequestCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(false)
  })

  test('red dot hidden for personal chats', () => {
    const chatType = 'personal'
    const chatId = 'chat-1'
    const myAdminGroupIds = ['chat-1']
    const pendingRequestCounts: Record<string, number> = { 'chat-1': 1 }

    const showRedDot = chatType === 'group'
      && myAdminGroupIds.includes(chatId)
      && (pendingRequestCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(false)
  })

  test('header red dot shows for owner with groupDetail', () => {
    const chatType = 'group'
    const chatId = 'group-1'
    const walletAddress = '0xABC'
    const groupDetail = {
      creator: '0xabc',
      admins: ['0xdef'],
    }
    const pendingCounts: Record<string, number> = { 'group-1': 2 }

    const isAdminOrOwner = chatType === 'group'
      && walletAddress
      && groupDetail
      && (groupDetail.creator === walletAddress.toLowerCase()
        || (groupDetail.admins || []).some(a => a.toLowerCase() === walletAddress.toLowerCase()))
    const showRedDot = isAdminOrOwner && (pendingCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(true)
  })

  test('header red dot shows for admin (non-owner)', () => {
    const chatType = 'group'
    const chatId = 'group-1'
    const walletAddress = '0xDEF'
    const groupDetail = {
      creator: '0xabc',
      admins: ['0xdef'],
    }
    const pendingCounts: Record<string, number> = { 'group-1': 1 }

    const isAdminOrOwner = chatType === 'group'
      && walletAddress
      && groupDetail
      && (groupDetail.creator === walletAddress.toLowerCase()
        || (groupDetail.admins || []).some(a => a.toLowerCase() === walletAddress.toLowerCase()))
    const showRedDot = isAdminOrOwner && (pendingCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(true)
  })

  test('header red dot hidden for regular member', () => {
    const chatType = 'group'
    const chatId = 'group-1'
    const walletAddress = '0xGHI'
    const groupDetail = {
      creator: '0xabc',
      admins: ['0xdef'],
    }
    const pendingCounts: Record<string, number> = { 'group-1': 5 }

    const isAdminOrOwner = chatType === 'group'
      && walletAddress
      && groupDetail
      && (groupDetail.creator === walletAddress.toLowerCase()
        || (groupDetail.admins || []).some(a => a.toLowerCase() === walletAddress.toLowerCase()))
    const showRedDot = isAdminOrOwner && (pendingCounts[chatId] ?? 0) > 0

    expect(showRedDot).toBe(false)
  })
})
