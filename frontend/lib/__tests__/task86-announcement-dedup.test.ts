/**
 * Task86 Test: Announcement popup de-duplication logic
 * Covers testchecklist sections A, B, F3
 */

// ─── Mock announcement popup logic (extracted from ChatPage effect) ───

type AnnouncementShownMap = Map<string, string> // chatId → announcement_at

interface GroupDetail {
  announcement: string | null
  announcement_at: string | null
  announcement_by: string | null
}

interface GroupMemberSettings {
  last_read_announcement_at: string | null
}

/**
 * Replicates the ChatPage effect logic for deciding whether to show the announcement popup.
 * Returns true if popup should open.
 */
function shouldShowAnnouncementPopup(
  chatId: string,
  chatType: string,
  groupDetail: GroupDetail | null,
  walletAddress: string | null,
  announcementShownRef: AnnouncementShownMap,
  myGroupSettings: Record<string, GroupMemberSettings | undefined>,
): boolean {
  if (chatType !== 'group' || !groupDetail?.announcement || !groupDetail.announcement_at) return false
  // Skip popup for the author who just published the announcement
  if (groupDetail.announcement_by && walletAddress && groupDetail.announcement_by === walletAddress.toLowerCase()) return false
  const currentAt = groupDetail.announcement_at
  const previouslyShownAt = announcementShownRef.get(chatId)
  // Only show if this announcement_at is genuinely newer than what we already showed
  if (previouslyShownAt && new Date(previouslyShownAt) >= new Date(currentAt)) return false
  const settings = myGroupSettings[chatId]
  const lastRead = settings?.last_read_announcement_at
  if (!lastRead || new Date(lastRead) < new Date(currentAt)) {
    announcementShownRef.set(chatId, currentAt)
    return true
  }
  return false
}

describe('Announcement popup de-duplication (Bugs #1 & #3)', () => {
  const CHAT_ID = 'group-123'
  const OTHER_WALLET = '0xother'
  const MY_WALLET = '0xmywallet'

  // ─── A1: Core Edit Flow ───

  test('A1.1: Owner edits announcement -> popup does NOT appear for owner (author skip)', () => {
    const ref: AnnouncementShownMap = new Map()
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'New text', announcement_at: '2026-03-16T10:00:00.000Z', announcement_by: MY_WALLET },
      MY_WALLET,
      ref, {}
    )
    expect(result).toBe(false) // Author skip
  })

  test('A1.2: Admin edits announcement -> popup does NOT appear for admin (author skip)', () => {
    const ref: AnnouncementShownMap = new Map()
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Admin text', announcement_at: '2026-03-16T10:01:00.000Z', announcement_by: '0xadmin' },
      '0xADMIN', // uppercase, should be compared case-insensitively
      ref, {}
    )
    expect(result).toBe(false)
  })

  test('A1.3: After clicking Confirm, popup does NOT reappear for same announcement', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T10:00:00.000Z'

    // First call: popup should appear (other user's announcement, unread)
    const result1 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Hello', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result1).toBe(true)

    // Second call with same announcement_at: popup should NOT appear
    const result2 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Hello', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result2).toBe(false)
  })

  test('A1.4: After dismiss, no second dialog for same announcement (ref remembers)', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T10:00:00.000Z'

    shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Test', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    // Simulate dismiss (ref already has the key)
    expect(ref.get(CHAT_ID)).toBe(at)

    // Realtime re-trigger with same timestamp (exact echo from server)
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Test', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result).toBe(false) // Should NOT reappear
  })

  // ─── A2: Edit Edge Cases ───

  test('A2.1: Realtime echo with slightly earlier timestamp -> no duplicate popup', () => {
    const ref: AnnouncementShownMap = new Map()
    // Client generates timestamp T1
    const clientAt = '2026-03-16T10:00:00.500Z'
    shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Msg', announcement_at: clientAt, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )

    // Realtime arrives with server timestamp T0 (slightly earlier)
    const serverAt = '2026-03-16T10:00:00.300Z'
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Msg', announcement_at: serverAt, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result).toBe(false) // T0 < T1, should not re-trigger
  })

  test('A2.2: Empty announcement -> no popup', () => {
    const ref: AnnouncementShownMap = new Map()
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: null, announcement_at: null, announcement_by: null },
      MY_WALLET, ref, {}
    )
    expect(result).toBe(false)
  })

  // ─── B1: New Member Core Flow ───

  test('B1.1: New member joins group with existing announcement -> popup appears ONCE', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    // New member has no settings (just joined)
    const result1 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Welcome!', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {} // no myGroupSettings[chatId]
    )
    expect(result1).toBe(true) // First time: should show

    // Effect fires again (Realtime echo)
    const result2 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Welcome!', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result2).toBe(false) // Duplicate: ref catches it
  })

  test('B1.2: After new member clicks Confirm -> popup does NOT reappear', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Welcome!', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )

    // After Confirm, last_read_announcement_at is set to now
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Welcome!', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref, { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T09:05:00.000Z' } }
    )
    expect(result).toBe(false)
  })

  test('B1.3: Member leaves and re-enters -> no popup (already read)', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    // Simulate already having read the announcement
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Old news', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T09:30:00.000Z' } }
    )
    expect(result).toBe(false)
  })

  // ─── B2: Announcement Read State ───

  test('B2.1: Updated announcement after confirmed -> popup appears again ONCE', () => {
    const ref: AnnouncementShownMap = new Map()
    const oldAt = '2026-03-16T09:00:00.000Z'
    const newAt = '2026-03-16T11:00:00.000Z'

    // First: read the old announcement
    ref.set(CHAT_ID, oldAt)

    // New announcement published
    const result1 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Updated!', announcement_at: newAt, announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T09:05:00.000Z' } }
    )
    expect(result1).toBe(true) // New announcement, should show

    // Second call: should NOT re-trigger
    const result2 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Updated!', announcement_at: newAt, announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T09:05:00.000Z' } }
    )
    expect(result2).toBe(false)
  })

  test('B2.2: Announcement has NOT changed since last read -> no popup', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Same', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T10:00:00.000Z' } } // read AFTER announcement
    )
    expect(result).toBe(false)
  })

  test('B2.3: Multiple members independently -> each gets their own popup (independent refs)', () => {
    const ref1: AnnouncementShownMap = new Map()
    const ref2: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    const result1 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Hi all', announcement_at: at, announcement_by: OTHER_WALLET },
      '0xmember1', ref1, {}
    )
    const result2 = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Hi all', announcement_at: at, announcement_by: OTHER_WALLET },
      '0xmember2', ref2, {}
    )
    expect(result1).toBe(true)
    expect(result2).toBe(true)
  })

  // ─── B3: Existing Member Regression ───

  test('B3.1: Existing member already confirmed -> no popup', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T09:00:00.000Z'

    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'Old', announcement_at: at, announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: at } } // read at same time
    )
    expect(result).toBe(false)
  })

  test('B3.2: Existing member with unread new announcement -> popup once', () => {
    const ref: AnnouncementShownMap = new Map()
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'group',
      { announcement: 'New one', announcement_at: '2026-03-16T12:00:00.000Z', announcement_by: OTHER_WALLET },
      MY_WALLET, ref,
      { [CHAT_ID]: { last_read_announcement_at: '2026-03-16T09:00:00.000Z' } }
    )
    expect(result).toBe(true)
  })

  // ─── F3: Announcement Popup Frequency Control ───

  test('F3.1: Same announcement version -> at most once per member', () => {
    const ref: AnnouncementShownMap = new Map()
    const at = '2026-03-16T10:00:00.000Z'
    const detail: GroupDetail = { announcement: 'Text', announcement_at: at, announcement_by: OTHER_WALLET }

    // First call
    expect(shouldShowAnnouncementPopup(CHAT_ID, 'group', detail, MY_WALLET, ref, {})).toBe(true)
    // All subsequent calls
    expect(shouldShowAnnouncementPopup(CHAT_ID, 'group', detail, MY_WALLET, ref, {})).toBe(false)
    expect(shouldShowAnnouncementPopup(CHAT_ID, 'group', detail, MY_WALLET, ref, {})).toBe(false)
    expect(shouldShowAnnouncementPopup(CHAT_ID, 'group', detail, MY_WALLET, ref, {})).toBe(false)
  })

  test('F3.2: Non-group chat type -> no popup', () => {
    const ref: AnnouncementShownMap = new Map()
    const result = shouldShowAnnouncementPopup(
      CHAT_ID, 'private',
      { announcement: 'Test', announcement_at: '2026-03-16T10:00:00.000Z', announcement_by: OTHER_WALLET },
      MY_WALLET, ref, {}
    )
    expect(result).toBe(false)
  })
})
