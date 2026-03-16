/**
 * Task 87 — Test verification for 3 bug fixes:
 * Bug 1: GroupInfoPanel IME input props applied to group name/nickname
 * Bug 2: inviteFriendsToGroupAction awaits refreshGroupDetail
 * Bug 3: GroupInfoPanel awaits loadProfiles before rendering
 */
import * as fs from 'fs'
import * as path from 'path'

// Read source files for static analysis
const GROUP_INFO_PANEL_PATH = path.resolve(__dirname, '../../components/chat/GroupInfoPanel.tsx')
const STORE_PATH = path.resolve(__dirname, '../store.ts')

const groupInfoPanelSource = fs.readFileSync(GROUP_INFO_PANEL_PATH, 'utf-8')
const storeSource = fs.readFileSync(STORE_PATH, 'utf-8')

// ===================================================================
// Bug 1: GroupInfoPanel IME input props applied
// ===================================================================
describe('Bug 1: GroupInfoPanel IME input props', () => {
  // 1.1 Core fix — IME props applied to inputs
  test('1.1.1 Group name input uses controlled value from nameIME', () => {
    // Must have value={nameIME.value} instead of defaultValue
    expect(groupInfoPanelSource).toContain('value={nameIME.value}')
    expect(groupInfoPanelSource).not.toMatch(/defaultValue=\{groupDetail\.name\}/)
  })

  test('1.1.2 Group name input has onCompositionStart from nameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onCompositionStart={nameInputProps.onCompositionStart}')
  })

  test('1.1.3 Group name input has onCompositionEnd from nameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onCompositionEnd={nameInputProps.onCompositionEnd}')
  })

  test('1.1.4 Group name input has onChange from nameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onChange={nameInputProps.onChange}')
  })

  test('1.1.5 Group nickname input uses controlled value from nicknameIME', () => {
    expect(groupInfoPanelSource).toContain('value={nicknameIME.value}')
    expect(groupInfoPanelSource).not.toMatch(/defaultValue=\{myNickname/)
  })

  test('1.1.6 Group nickname input has onCompositionStart from nicknameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onCompositionStart={nicknameInputProps.onCompositionStart}')
  })

  test('1.1.7 Group nickname input has onCompositionEnd from nicknameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onCompositionEnd={nicknameInputProps.onCompositionEnd}')
  })

  test('1.1.8 Group nickname input has onChange from nicknameInputProps', () => {
    expect(groupInfoPanelSource).toContain('onChange={nicknameInputProps.onChange}')
  })

  // 1.1 onBlur guard
  test('1.1.9 Group name onBlur uses rAF + isComposing guard', () => {
    // The onBlur for name input should use requestAnimationFrame and check isComposingRef
    const nameBlurPattern = /onBlur=\{[^}]*requestAnimationFrame[^}]*nameIME\.isComposingRef\.current[^}]*handleSaveName/s
    expect(groupInfoPanelSource).toMatch(nameBlurPattern)
  })

  test('1.1.10 Group nickname onBlur uses rAF + isComposing guard', () => {
    const nicknameBlurPattern = /onBlur=\{[^}]*requestAnimationFrame[^}]*nicknameIME\.isComposingRef\.current[^}]*handleSaveNickname/s
    expect(groupInfoPanelSource).toMatch(nicknameBlurPattern)
  })

  // 1.1 onKeyDown merge
  test('1.1.11 Group name onKeyDown delegates to nameInputProps.onKeyDown', () => {
    expect(groupInfoPanelSource).toContain('nameInputProps.onKeyDown(e)')
  })

  test('1.1.12 Group nickname onKeyDown delegates to nicknameInputProps.onKeyDown', () => {
    expect(groupInfoPanelSource).toContain('nicknameInputProps.onKeyDown(e)')
  })

  test('1.1.13 Escape key still cancels name editing', () => {
    // Check that Escape handler exists alongside the delegated onKeyDown
    const nameKeydownSection = groupInfoPanelSource.match(
      /nameInputProps\.onKeyDown\(e\)[\s\S]{0,100}Escape[\s\S]{0,50}setEditingName\(false\)/
    )
    expect(nameKeydownSection).not.toBeNull()
  })

  test('1.1.14 Escape key still cancels nickname editing', () => {
    const nicknameKeydownSection = groupInfoPanelSource.match(
      /nicknameInputProps\.onKeyDown\(e\)[\s\S]{0,100}Escape[\s\S]{0,50}setEditingNickname\(false\)/
    )
    expect(nicknameKeydownSection).not.toBeNull()
  })

  // 1.4 maxLength handled by getInputProps not HTML attribute
  test('1.4.1 nameInputProps created with maxLength option', () => {
    expect(groupInfoPanelSource).toMatch(/nameIME\.getInputProps\(\{[^}]*maxLength:\s*50/)
  })

  test('1.4.2 No HTML maxLength on name input (handled by hook)', () => {
    // The name input should NOT have maxLength={50} as HTML attribute
    // because it's handled by getInputProps onChange to avoid truncating mid-composition
    const nameInputSection = groupInfoPanelSource.match(
      /value=\{nameIME\.value\}[\s\S]*?disabled=\{savingName\}/
    )
    expect(nameInputSection).not.toBeNull()
    expect(nameInputSection![0]).not.toContain('maxLength={50}')
  })

  // 1.5 Save propagation — refs still present for focus useEffect
  test('1.5.1 nameInputRef still used for auto-focus', () => {
    expect(groupInfoPanelSource).toContain('ref={nameInputRef}')
    expect(groupInfoPanelSource).toMatch(/editingName\)\s*nameInputRef\.current\?\.focus\(\)/)
  })

  test('1.5.2 nicknameInputRef still used for auto-focus', () => {
    expect(groupInfoPanelSource).toContain('ref={nicknameInputRef}')
    expect(groupInfoPanelSource).toMatch(/editingNickname\)\s*nicknameInputRef\.current\?\.focus\(\)/)
  })

  // 1.5 setValue called when entering edit mode
  test('1.5.3 nameIME.setValue called with groupDetail.name when editing starts', () => {
    expect(groupInfoPanelSource).toContain('nameIME.setValue(groupDetail.name)')
  })

  test('1.5.4 nicknameIME.setValue called with myNickname when editing starts', () => {
    expect(groupInfoPanelSource).toMatch(/nicknameIME\.setValue\(myNickname\s*\|\|\s*''\)/)
  })
})

// ===================================================================
// Bug 2: Invite list refresh after auto-join
// ===================================================================
describe('Bug 2: inviteFriendsToGroupAction awaits refreshGroupDetail', () => {
  test('2.1.1 refreshGroupDetail is awaited in inviteFriendsToGroupAction', () => {
    // Find the inviteFriendsToGroupAction function
    const actionMatch = storeSource.match(
      /inviteFriendsToGroupAction:\s*async\s*\([\s\S]*?\n\s*\},/
    )
    expect(actionMatch).not.toBeNull()
    const actionBody = actionMatch![0]

    // Check that refreshGroupDetail is awaited
    expect(actionBody).toContain('await get().refreshGroupDetail(groupId)')
  })

  test('2.1.2 refreshGroupDetail is NOT fire-and-forget', () => {
    // The old pattern was: get().refreshGroupDetail(groupId).catch(() => {})
    // Without await. Verify the await is present.
    const inviteSection = storeSource.match(
      /if\s*\(!needApproval\)[\s\S]*?}/
    )
    expect(inviteSection).not.toBeNull()

    // Should have 'await get().refreshGroupDetail' not just 'get().refreshGroupDetail'
    const refreshLine = inviteSection![0].match(/(?:await\s+)?get\(\)\.refreshGroupDetail/)
    expect(refreshLine).not.toBeNull()
    expect(refreshLine![0]).toContain('await')
  })

  test('2.1.3 refreshChats is also awaited (no regression)', () => {
    const actionMatch = storeSource.match(
      /inviteFriendsToGroupAction[\s\S]*?if\s*\(!needApproval\)[\s\S]*?}/
    )
    expect(actionMatch).not.toBeNull()
    expect(actionMatch![0]).toContain('await get().refreshChats()')
  })
})

// ===================================================================
// Bug 3: Member nicknames loaded before panel renders
// ===================================================================
describe('Bug 3: GroupInfoPanel awaits loadProfiles', () => {
  test('3.1.1 openGroupManagement .then callback is async', () => {
    expect(groupInfoPanelSource).toMatch(/openGroupManagement\(groupId\)\.then\(async\s/)
  })

  test('3.1.2 loadProfiles is awaited', () => {
    expect(groupInfoPanelSource).toContain('await loadProfiles(detail.members)')
  })

  test('3.1.3 Second cancelled check exists after await', () => {
    // After await loadProfiles, there should be a cancelled check before setLoading
    const profileSection = groupInfoPanelSource.match(
      /await loadProfiles\(detail\.members\)[\s\S]*?setLoading\(false\)/
    )
    expect(profileSection).not.toBeNull()
    expect(profileSection![0]).toContain('if (cancelled) return')
  })

  test('3.1.4 setLoading(false) comes AFTER await loadProfiles', () => {
    // Find the useEffect for group detail loading
    const effectMatch = groupInfoPanelSource.match(
      /openGroupManagement\(groupId\)\.then\(async[\s\S]*?setLoading\(false\)/
    )
    expect(effectMatch).not.toBeNull()
    const effectBody = effectMatch![0]

    // loadProfiles should come before setLoading in the code
    const loadIndex = effectBody.indexOf('await loadProfiles')
    const setLoadingIndex = effectBody.indexOf('setLoading(false)')
    expect(loadIndex).toBeGreaterThan(-1)
    expect(setLoadingIndex).toBeGreaterThan(loadIndex)
  })
})

// ===================================================================
// Regression checks
// ===================================================================
describe('Regression checks', () => {
  test('R1: GroupAnnouncementModal still uses getInputProps (not affected)', () => {
    const announcementPath = path.resolve(__dirname, '../../components/chat/GroupAnnouncementModal.tsx')
    const announcementSource = fs.readFileSync(announcementPath, 'utf-8')
    expect(announcementSource).toContain('getInputProps')
    expect(announcementSource).toContain('{...getInputProps(')
  })

  test('R2: AddFriendModal still uses useIMEInput (not affected)', () => {
    const addFriendPath = path.resolve(__dirname, '../../components/chat/AddFriendModal.tsx')
    const addFriendSource = fs.readFileSync(addFriendPath, 'utf-8')
    expect(addFriendSource).toContain('useIMEInput')
    expect(addFriendSource).toContain('getSearchInputProps')
  })

  test('R3: ChatPage search still uses useIMEInput (not affected)', () => {
    const chatPagePath = path.resolve(__dirname, '../../components/pages/ChatPage.tsx')
    const chatPageSource = fs.readFileSync(chatPagePath, 'utf-8')
    expect(chatPageSource).toContain('useIMEInput')
  })

  test('R4: InviteFriendsToGroupModal existingSet uses toLowerCase', () => {
    const invitePath = path.resolve(__dirname, '../../components/chat/InviteFriendsToGroupModal.tsx')
    const inviteSource = fs.readFileSync(invitePath, 'utf-8')
    expect(inviteSource).toContain('existingMembers.map((m) => m.toLowerCase())')
  })

  test('R5: GroupInfoPanel still has toggle handlers (pin, DND, mute)', () => {
    expect(groupInfoPanelSource).toContain('handleTogglePin')
    expect(groupInfoPanelSource).toContain('handleToggleDND')
  })

  test('R6: GroupInfoPanel avatar upload not affected by IME changes', () => {
    expect(groupInfoPanelSource).toContain('handleAvatarUpload')
    expect(groupInfoPanelSource).toContain('ref={avatarInputRef}')
  })

  test('R7: useIMEInput hooks are properly created in GroupInfoPanel', () => {
    expect(groupInfoPanelSource).toMatch(/const nameIME = useIMEInput\(/)
    expect(groupInfoPanelSource).toMatch(/const nicknameIME = useIMEInput\(/)
  })

  test('R8: getInputProps called with correct options', () => {
    expect(groupInfoPanelSource).toMatch(/nameIME\.getInputProps\(\{\s*onEnter:\s*handleSaveName/)
    expect(groupInfoPanelSource).toMatch(/nicknameIME\.getInputProps\(\{\s*onEnter:\s*handleSaveNickname/)
  })
})
