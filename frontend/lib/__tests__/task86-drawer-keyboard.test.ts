/**
 * Task86 Test: Drawer keyboard avoidance logic
 * Covers testchecklist sections C1, C2, C3
 *
 * Since Capacitor Keyboard plugin and visualViewport are not available in Jest/Node,
 * we test the logic structure and code presence verification.
 */

import * as fs from 'fs'
import * as path from 'path'

const FRONTEND_ROOT = path.resolve(__dirname, '..', '..')

describe('Drawer keyboard avoidance — Code structure verification', () => {
  // ─── C1 & C2: Hook existence and structure ───

  test('C1/C2: use-drawer-keyboard.ts hook exists', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    expect(fs.existsSync(hookPath)).toBe(true)
  })

  test('C1/C2: Hook listens to Capacitor Keyboard events', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    const content = fs.readFileSync(hookPath, 'utf-8')

    // Must have Capacitor keyboard listener
    expect(content).toContain('keyboardWillShow')
    expect(content).toContain('keyboardDidHide')
    expect(content).toContain('@capacitor/keyboard')
  })

  test('C1/C2: Hook has visualViewport fallback for web', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    const content = fs.readFileSync(hookPath, 'utf-8')

    expect(content).toContain('visualViewport')
    expect(content).toContain('resize')
  })

  test('C1/C2: Hook cleans up listeners on unmount', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    const content = fs.readFileSync(hookPath, 'utf-8')

    expect(content).toContain('mounted = false')
    expect(content).toContain('h.remove()')
  })

  test('C1/C2: Hook returns keyboardHeight number (default 0)', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    const content = fs.readFileSync(hookPath, 'utf-8')

    expect(content).toContain('useState(0)')
    expect(content).toContain('return keyboardHeight')
  })

  // ─── DrawerContent integration ───

  test('DrawerContent uses useDrawerKeyboard hook', () => {
    const drawerPath = path.join(FRONTEND_ROOT, 'components', 'ui', 'drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf-8')

    expect(content).toContain("import { useDrawerKeyboard } from '@/hooks/use-drawer-keyboard'")
    expect(content).toContain('useDrawerKeyboard()')
  })

  test('DrawerContent applies paddingBottom when keyboard is open', () => {
    const drawerPath = path.join(FRONTEND_ROOT, 'components', 'ui', 'drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf-8')

    expect(content).toContain('paddingBottom')
    expect(content).toContain('keyboardHeight')
    expect(content).toContain('transition-[padding]')
  })

  test('DrawerContent does NOT apply transform when keyboardHeight is 0', () => {
    const drawerPath = path.join(FRONTEND_ROOT, 'components', 'ui', 'drawer.tsx')
    const content = fs.readFileSync(drawerPath, 'utf-8')

    // Check conditional: only apply when keyboardHeight > 0
    expect(content).toContain('keyboardHeight > 0')
    expect(content).toContain(': undefined')
  })

  // ─── C3: Regression — old scrollIntoView removed ───

  test('C3: JoinGroupModal no longer has scrollIntoView workaround', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'JoinGroupModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).not.toContain('scrollIntoView')
  })

  test('C3: GroupAnnouncementModal no longer has scrollIntoView workaround', () => {
    const modalPath = path.join(FRONTEND_ROOT, 'components', 'chat', 'GroupAnnouncementModal.tsx')
    const content = fs.readFileSync(modalPath, 'utf-8')

    expect(content).not.toContain('scrollIntoView')
  })

  // ─── C3: Chat input keyboard logic is untouched (no regression) ───

  test('C3: ChatPage still has its own Capacitor Keyboard.addListener for chat input', () => {
    const chatPagePath = path.join(FRONTEND_ROOT, 'components', 'pages', 'ChatPage.tsx')
    const content = fs.readFileSync(chatPagePath, 'utf-8')

    expect(content).toContain("Keyboard.addListener(\"keyboardWillShow\"")
    expect(content).toContain("Keyboard.addListener(\"keyboardDidHide\"")
    expect(content).toContain('keyboardOverlap')
  })
})

describe('Drawer keyboard avoidance — visual viewport threshold', () => {
  test('Only triggers keyboard when diff > 50px (filter toolbar/addressbar resize)', () => {
    const hookPath = path.join(FRONTEND_ROOT, 'hooks', 'use-drawer-keyboard.ts')
    const content = fs.readFileSync(hookPath, 'utf-8')

    // The hook should filter small viewport changes (< 50px) from toolbar/addressbar
    expect(content).toContain('diff > 50')
  })
})
