/**
 * Task89 Test: Verification of 10 bug fixes
 * Tests verify code structure matches implementation requirements
 */

import * as fs from 'fs'
import * as path from 'path'

const FRONTEND_ROOT = path.resolve(__dirname, '..', '..')

// ─── A: Duplicate Announcement Popup (Bugs #1, #7, #8) ───

describe('A: Announcement Popup Dedup', () => {
  test('A1-A4: Module-level dedup Set prevents duplicate popups', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    // Module-level dedup (not component-local useRef)
    expect(content).toContain('const announcementShownKeys = new Set<string>()')
    expect(content).toContain('const announcementCooldownMap = new Map<string, number>()')

    // Dedup key uses chatId + announcement_at
    expect(content).toContain('`${chat.id}|${currentAt}`')
    expect(content).toContain('announcementShownKeys.has(dedupKey)')
    expect(content).toContain('announcementShownKeys.add(dedupKey)')

    // Cooldown guard (3 seconds)
    expect(content).toContain('Date.now() - lastShown < 3000')

    // Reads latest myGroupSettings from store (avoid stale closure)
    expect(content).toContain('useStore.getState().myGroupSettings')

    // Author-skip guard still present
    expect(content).toContain('groupDetail.announcement_by === walletAddress.toLowerCase()')
  })

  test('A4: setAnnouncementAction does NOT patch announcement_at locally', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    // Should patch announcement and announcement_by but NOT announcement_at
    expect(content).toContain('patchActiveGroupDetail(groupId, { announcement: text, announcement_by:')
    // The old pattern with announcement_at should be removed
    expect(content).not.toContain('patchActiveGroupDetail(groupId, { announcement: text, announcement_at:')
  })
})

// ─── B: Announcement Edit Cancel Flow (Bug #2) ───

describe('B: Announcement Edit Cancel Flow', () => {
  test('B3: Cancel button in edit mode calls handleClose()', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    // Cancel button should call handleClose, not just setIsEditing(false)
    expect(content).toContain('setIsEditing(false); handleClose()')
  })
})

// ─── C: Drawer Snap Point Jump (Bugs #3, #9) ───

describe('C: Drawer Snap Point Stability', () => {
  test('C1-C7: DrawerContent uses paddingBottom instead of translateY', () => {
    const drawerPath = path.join(FRONTEND_ROOT, 'components', 'ui', 'drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf-8')

    // Should use paddingBottom
    expect(content).toContain('paddingBottom')
    // Should NOT use translateY
    expect(content).not.toContain('translateY')
    // Should use padding transition, not transform transition
    expect(content).toContain('transition-[padding]')
    expect(content).not.toContain('transition-transform')
  })

  test('C2: JoinGroupModal does NOT use autoFocus as JSX attribute', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    // autoFocus removed as JSX attribute (may still appear in comments)
    expect(content).not.toMatch(/<[^>]*autoFocus/)

    // Delayed programmatic focus instead
    expect(content).toContain('inputRef.current?.focus()')
    expect(content).toContain('setTimeout')
  })
})

// ─── D: Paste Invite Link Search (Bug #4) ───

describe('D: Paste Invite Link Triggers Search', () => {
  test('D1-D6: JoinGroupModal has onPaste handler', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    // onPaste handler exists
    expect(content).toContain('onPaste=')
    expect(content).toContain('clipboardData')
    // Uses setTimeout to ensure DOM value is updated
    expect(content).toContain("getData('text')")
  })
})

// ─── E: Toast Auto-Dismiss (Bug #5) ───

describe('E: Toast Auto-Dismiss', () => {
  test('E1-E3: Global toast duration is 1000ms', () => {
    const pagePath = path.join(FRONTEND_ROOT, 'app', 'page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')

    expect(content).toContain('duration: 1000')
    expect(content).not.toContain('duration: 2000')
  })

  test('E7: GroupAnnouncementModal uses react-hot-toast', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("from 'react-hot-toast'")
    expect(content).not.toContain("from '@/hooks/use-toast'")
  })

  test('E7: GroupSettingsPanel uses react-hot-toast', () => {
    const panelPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupSettingsPanel.tsx')
    const content = fs.readFileSync(panelPath, 'utf-8')

    expect(content).toContain("from 'react-hot-toast'")
    expect(content).not.toContain("from '@/hooks/use-toast'")
    // Uses hotToast.success and hotToast.error
    expect(content).toContain('hotToast.success')
    expect(content).toContain('hotToast.error')
  })

  test('E7: TransferOwnerModal uses react-hot-toast', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'TransferOwnerModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).toContain("from 'react-hot-toast'")
    expect(content).not.toContain("from '@/hooks/use-toast'")
    expect(content).toContain('hotToast.success')
    expect(content).toContain('hotToast.error')
  })

  test('E7: TopBar and SidebarNav toast calls have no custom duration override', () => {
    const topBarPath = path.join(FRONTEND_ROOT, 'components', 'TopBar.tsx')
    const topBar = fs.readFileSync(topBarPath, 'utf-8')
    // Toast calls should not have { duration: ... } overrides (CSS animation duration: is OK)
    expect(topBar).not.toMatch(/toast\([^)]*duration:/)

    const sidebarPath = path.join(FRONTEND_ROOT, 'components', 'SidebarNav.tsx')
    const sidebar = fs.readFileSync(sidebarPath, 'utf-8')
    expect(sidebar).not.toMatch(/toast\([^)]*duration:/)
  })

  test('E7: LoginApp Toaster uses 1000ms duration', () => {
    const loginPath = path.join(FRONTEND_ROOT, 'components', 'login', 'LoginApp.tsx')
    const content = fs.readFileSync(loginPath, 'utf-8')

    expect(content).toContain('duration: 1000')
    expect(content).not.toContain('duration: 2500')
    expect(content).not.toContain('duration: 1500')
  })
})

// ─── F: Wallet Switch State (Bug #6) ───

describe('F: Wallet Switch State', () => {
  test('F2-F3: "Connected" label removed from AssetsPage', () => {
    const assetsPath = path.join(FRONTEND_ROOT, 'components', 'pages', 'AssetsPage.tsx')
    const content = fs.readFileSync(assetsPath, 'utf-8')

    expect(content).not.toContain("'已连接'")
    expect(content).not.toContain("'Connected'")
  })

  test('F4: Wagmi sync effect guards against non-external wallet override', () => {
    const pagePath = path.join(FRONTEND_ROOT, 'app', 'page.tsx')
    const content = fs.readFileSync(pagePath, 'utf-8')

    // Guard checks wallet type before syncing
    expect(content).toContain("currentWallet.type === 'external'")
    expect(content).toContain('wallets.find(w => w.id === currentWalletId)')
  })
})

// ─── J: Chat State Reset on Wallet Switch (Bug #10) ───

describe('J: Chat State Reset on Wallet Switch', () => {
  test('J1-J4: switchWallet resets all group-related state', () => {
    const storePath = path.join(FRONTEND_ROOT, 'lib', 'store.ts')
    const content = fs.readFileSync(storePath, 'utf-8')

    // Find switchWallet implementation (skip the type definition line)
    const implStart = content.indexOf('switchWallet: (id) =>')
    const implEnd = content.indexOf('toggleCoinFavorite:', implStart)
    const switchWalletSection = content.slice(implStart, implEnd)

    expect(switchWalletSection).toContain('groupJoinedAtMap: {}')
    expect(switchWalletSection).toContain('myGroupSettings: {}')
    expect(switchWalletSection).toContain('pendingRequestCounts: {}')
    expect(switchWalletSection).toContain('myMuteStatus: {}')
    expect(switchWalletSection).toContain('activeGroupDetail: {}')
  })
})

// ─── L2: Realtime Event Dedup ───

describe('L2: Realtime Dedup Quality', () => {
  test('L2.2: Dedup guard persists across component remounts (module-level)', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    // Module-level declarations (before any function/component)
    const moduleSection = content.slice(0, content.indexOf('function ChatDetail'))
    expect(moduleSection).toContain('announcementShownKeys')
    expect(moduleSection).toContain('announcementCooldownMap')
  })

  test('L2.3: Author-skip guard prevents self-popup', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    expect(content).toContain('groupDetail.announcement_by === walletAddress.toLowerCase()')
  })
})
