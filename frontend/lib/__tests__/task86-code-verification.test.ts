/**
 * Task86 Test: Code verification for E (data link), F (interaction quality) sections
 * These tests verify the code structure meets testchecklist requirements
 */

import * as fs from 'fs'
import * as path from 'path'

const FRONTEND_ROOT = path.resolve(__dirname, '..', '..')

describe('E1: Data Link Consistency — Code verification', () => {
  test('E1.1: setAnnouncementAction updates announcement + announcement_at in store', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    // setAnnouncementAction should call setGroupAnnouncement (DB write)
    expect(content).toContain('setGroupAnnouncement')
    // And patchActiveGroupDetail for local state
    expect(content).toContain('patchActiveGroupDetail(groupId, { announcement: text, announcement_at:')
  })

  test('E1.2: markAnnouncementRead updates last_read_announcement_at', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    expect(content).toContain('last_read_announcement_at')
    expect(content).toContain('updateMyGroupSettings')
  })

  test('E1.3: Announcement read state comparison uses Date comparison', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    // Must compare dates properly
    expect(content).toContain('new Date(lastRead) < new Date(currentAt)')
  })

  test('E1.4: fetchGroupPreviewByToken resolves invite token from DB', () => {
    const gmPath = path.join(FRONTEND_ROOT, 'lib', 'group-management.ts')
    const content = fs.readFileSync(gmPath, 'utf-8')

    expect(content).toContain('fetchGroupPreviewByToken')
    expect(content).toContain('group_invites')
    expect(content).toContain('.eq(\'token\', token)')
  })

  test('E1.5: Realtime subscription handles groups UPDATE event', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    expect(content).toContain("event: 'UPDATE', schema: 'public', table: 'groups'")
    expect(content).toContain('updatedGroup.announcement')
  })
})

describe('E2: Permission & Role Boundary — Code verification', () => {
  test('E2.1: GroupAnnouncementModal edit button is gated by canEdit prop', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain('canEdit')
    // Edit button only shows when canEdit is true
    expect(content).toContain('{canEdit && (')
  })

  test('E2.2: ChatPage passes canEdit based on creator/admin role', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    expect(content).toContain('groupDetail.creator === walletAddress')
    expect(content).toContain('groupDetail.admins.includes')
  })
})

describe('F1: Input Interaction Compatibility — Code verification', () => {
  test('F1.1: GroupAnnouncementModal uses useIMEInput for textarea', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("import { useIMEInput } from '@/hooks/use-ime-input'")
    expect(content).toContain('useIMEInput')
    expect(content).toContain('getInputProps')
  })

  test('F1.2: JoinGroupModal input triggers preview via onChange (no Enter required)', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    // Preview is triggered by useEffect watching input, not by onKeyDown
    expect(content).toContain('useEffect(() => {')
    expect(content).toContain('parseInviteToken(trimmed)')
    expect(content).toContain('fetchGroupPreviewByToken')
  })

  test('F1.3: JoinGroupModal paste button triggers setInput which triggers preview', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain('handlePaste')
    expect(content).toContain('setInput(value.trim())')
    // useEffect depends on [input], so setInput triggers the preview effect
    expect(content).toContain('}, [input])')
  })
})

describe('F2: Operation Feedback — Code verification', () => {
  test('F2.1: setAnnouncementAction shows toast on success', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    expect(content).toContain("toast.success(t('group.announcementUpdated'")
  })

  test('F2.2: GroupAnnouncementModal shows toast on save error', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("variant: 'destructive'")
    expect(content).toContain("t('group.error.operationFailed'")
  })

  test('F2.3: JoinGroupModal shows loading spinner while preview fetches', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain('loadingPreview')
    expect(content).toContain('animate-spin')
  })

  test('F2.4: JoinGroupModal shows toast on join success', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("toast.success(locale === 'zh' ? '已加入群聊' : 'Joined group')")
  })

  test('F2.5: JoinGroupModal shows pending message for approval-required groups', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("'pending':")
    expect(content).toContain('申请已提交')
  })
})

describe('F4: Visual Consistency — Code verification', () => {
  test('F4.1: JoinGroupModal preview card uses same styles as ChatPage preview', () => {
    const joinModalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const joinContent = fs.readFileSync(joinModalPath, 'utf-8')
    const chatContent = fs.readFileSync(chatPagePath, 'utf-8')

    // Both use the same ogbo-blue styling
    expect(joinContent).toContain('bg-[var(--ogbo-blue)]/10')
    expect(chatContent).toContain('bg-[var(--ogbo-blue)]/10')

    // Both use Users icon
    expect(joinContent).toContain('Users')
    expect(chatContent).toContain('Users')

    // Both show member count
    expect(joinContent).toContain('memberCount')
    expect(chatContent).toContain('memberCount')
  })

  test('F4.2: DrawerContent transition is smooth (200ms duration)', () => {
    const drawerPath = path.join(FRONTEND_ROOT, 'components', 'ui', 'drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf-8')

    expect(content).toContain('transition-transform duration-200')
  })
})
