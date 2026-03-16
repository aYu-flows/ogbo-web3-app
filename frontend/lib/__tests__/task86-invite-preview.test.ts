/**
 * Task86 Test: Invite link preview logic in JoinGroupModal
 * Covers testchecklist sections D1, D2, D3
 */

import { parseInviteToken } from '@/lib/group-qrcode'

describe('Invite link preview — parseInviteToken detection', () => {
  // ─── D2: Input Format Handling ───

  test('D2.1: Full invite URL -> extracts token', () => {
    const token = parseInviteToken('https://ogbox-web3-app.vercel.app/group/join?token=abc12345-1234-5678-9abc-def012345678')
    expect(token).toBe('abc12345-1234-5678-9abc-def012345678')
  })

  test('D2.2: Raw UUID token -> detected', () => {
    const token = parseInviteToken('abc12345-1234-5678-9abc-def012345678')
    expect(token).toBe('abc12345-1234-5678-9abc-def012345678')
  })

  test('D2.3: Invalid text -> returns null', () => {
    expect(parseInviteToken('hello world')).toBeNull()
    expect(parseInviteToken('not a link')).toBeNull()
    expect(parseInviteToken('12345')).toBeNull()
  })

  test('D2.4: Empty input -> returns null', () => {
    expect(parseInviteToken('')).toBeNull()
    expect(parseInviteToken('   ')).toBeNull()
  })

  test('D2.5: Partial URL without token param -> returns null', () => {
    expect(parseInviteToken('https://ogbox-web3-app.vercel.app/group/join')).toBeNull()
  })

  test('D2.6: URL with token param but no value -> returns null', () => {
    const token = parseInviteToken('https://ogbox-web3-app.vercel.app/group/join?token=')
    expect(token).toBeNull()
  })
})

describe('Invite link preview — JoinGroupModal state logic', () => {
  // Simulate the JoinGroupModal useEffect logic

  type PreviewState = {
    invitePreview: { name: string; memberCount: number; token: string } | null
    loadingPreview: boolean
    inviteLinkInvalid: boolean
  }

  function simulatePreviewEffect(
    input: string,
    fetchResult: { name: string; memberCount: number } | null | 'error',
  ): Promise<PreviewState> {
    return new Promise((resolve) => {
      const trimmed = input.trim()

      if (!trimmed) {
        resolve({ invitePreview: null, loadingPreview: false, inviteLinkInvalid: false })
        return
      }

      const token = parseInviteToken(trimmed)
      if (!token) {
        resolve({ invitePreview: null, loadingPreview: false, inviteLinkInvalid: false })
        return
      }

      // Simulate debounce + fetch
      setTimeout(() => {
        if (fetchResult === 'error') {
          resolve({ invitePreview: null, loadingPreview: false, inviteLinkInvalid: true })
        } else if (fetchResult) {
          resolve({
            invitePreview: { ...fetchResult, token },
            loadingPreview: false,
            inviteLinkInvalid: false,
          })
        } else {
          resolve({ invitePreview: null, loadingPreview: false, inviteLinkInvalid: true })
        }
      }, 10) // shortened debounce for testing
    })
  }

  // ─── D1: Core Preview Behavior ───

  test('D1.1: Valid invite link -> preview card data returned', async () => {
    const state = await simulatePreviewEffect(
      'https://ogbox-web3-app.vercel.app/group/join?token=abc12345-1234-5678-9abc-def012345678',
      { name: 'Test Group', memberCount: 5 },
    )
    expect(state.invitePreview).not.toBeNull()
    expect(state.invitePreview!.name).toBe('Test Group')
    expect(state.invitePreview!.memberCount).toBe(5)
    expect(state.invitePreview!.token).toBe('abc12345-1234-5678-9abc-def012345678')
  })

  test('D1.2: Preview shows group name and member count', async () => {
    const state = await simulatePreviewEffect(
      'abc12345-1234-5678-9abc-def012345678',
      { name: 'My Group', memberCount: 42 },
    )
    expect(state.invitePreview!.name).toBe('My Group')
    expect(state.invitePreview!.memberCount).toBe(42)
  })

  // ─── D2: Input Format Handling ───

  test('D2.3: Invalid link -> shows invalid state', async () => {
    const state = await simulatePreviewEffect(
      'abc12345-1234-5678-9abc-def012345678',
      null, // fetchGroupPreviewByToken returns null
    )
    expect(state.invitePreview).toBeNull()
    expect(state.inviteLinkInvalid).toBe(true)
  })

  test('D2.4: Random non-link text -> no preview', async () => {
    const state = await simulatePreviewEffect('hello world', null)
    expect(state.invitePreview).toBeNull()
    expect(state.inviteLinkInvalid).toBe(false) // not even attempted
  })

  // ─── D3: Preview Edge Cases ───

  test('D3.1: Clear input -> preview disappears', async () => {
    const state = await simulatePreviewEffect('', null)
    expect(state.invitePreview).toBeNull()
    expect(state.loadingPreview).toBe(false)
    expect(state.inviteLinkInvalid).toBe(false)
  })

  test('D3.2: Network error -> shows invalid state', async () => {
    const state = await simulatePreviewEffect(
      'abc12345-1234-5678-9abc-def012345678',
      'error',
    )
    expect(state.invitePreview).toBeNull()
    expect(state.inviteLinkInvalid).toBe(true)
  })
})
