# Task 86 — Group Announcement & Join Group UI Bugs

## 1. Task Requirements

Five bugs need to be fixed in the group announcement and join group features:

### Bug 1: Duplicate announcement popup after editing
**Current behavior:** After an admin edits and saves a group announcement, the announcement confirmation modal pops up again (appearing as a duplicate).
**Root cause:** When `setAnnouncementAction` runs, it calls `patchActiveGroupDetail` to update `announcement_at` with a client-generated timestamp. Shortly after, the Supabase Realtime `groups UPDATE` event arrives with the server-side `announcement_at` value (slightly different timestamp). The ChatPage effect (line ~258) watches `groupDetail?.announcement_at` — when it changes, the effect generates a new `shownKey` (format `chatId:announcement_at`) that is NOT in `announcementShownRef`, so it opens the announcement modal again.
**Fix:**
1. Change `announcementShownRef` to use a Map keyed by `chat.id` → last shown `announcement_at`. Only show popup when the new `announcement_at` is genuinely newer than the stored value (not just different due to Realtime echo).
2. Skip showing the announcement popup if the current user is the one who just published it (`announcement_by === walletAddress`).

### Bug 2 & 4: Keyboard blocking inputs in Drawer (JoinGroupModal + GroupAnnouncementModal)
**Current behavior:** When the keyboard opens on mobile (especially in Capacitor WebView), the input fields in the Drawer are covered by the keyboard. The current `scrollIntoView` with 300ms delay is unreliable on Capacitor.
**Root cause:** The `vaul` Drawer component uses `position: fixed; bottom: 0`. When the native keyboard opens in Capacitor Edge-to-Edge mode, the fixed-positioned Drawer does not move. The `scrollIntoView` workaround cannot scroll fixed elements. The ChatPage chat input uses Capacitor `Keyboard` plugin listeners to add `paddingBottom`, but Drawers don't use this approach.
**Fix:** Create a reusable hook `useDrawerKeyboard` that:
- Listens for Capacitor `Keyboard.keyboardWillShow` / `keyboardDidHide` events on native platforms
- Falls back to `window.visualViewport` `resize` event on web
- Returns a `keyboardHeight` value
- Apply `paddingBottom: keyboardHeight` or `transform: translateY(-keyboardHeight)` to the Drawer content wrapper
- Apply this hook in `JoinGroupModal`, `GroupAnnouncementModal`, and the `DrawerContent` component in `drawer.tsx` (system-wide fix for ALL Drawers with inputs)

**System-wide approach:** Modify `DrawerContent` in `components/ui/drawer.tsx` to include keyboard avoidance by default. This ensures ALL existing and future Drawers with inputs get proper keyboard handling.

### Bug 3: New group member sees announcement popup twice
**Current behavior:** When a new member opens a group chat, the announcement popup appears, they close it, and then it appears again.
**Root cause:** Same root cause as Bug 1 — Realtime re-trigger with different `announcement_at` timestamp. Additionally, `GroupAnnouncementModal`'s "Confirm" button calls `markAnnouncementRead` directly, then `onClose()` triggers Drawer's `onOpenChange(false)` which calls `handleClose()` which calls `markAnnouncementRead` again — a double DB write.
**Fix:**
1. Same `announcementShownRef` fix as Bug 1 (Map-based de-duplication).
2. In `GroupAnnouncementModal`: "Confirm" button should call `handleClose()` instead of calling `markAnnouncementRead` + `onClose()` separately. This prevents the double `markAnnouncementRead` call.

### Bug 5: Invite link preview in JoinGroupModal
**Current behavior:** The invite preview works in the ChatPage search bar but NOT in the JoinGroupModal. When a user pastes an invite link in JoinGroupModal, there is no preview — the user must click "Join" blindly.
**Root cause:** JoinGroupModal has no invite preview logic — it only parses the token at join time.
**Fix:** Add invite preview logic to JoinGroupModal:
- Use `useEffect` to watch `input` value changes
- Call `parseInviteToken` to extract token from the input
- If token found, call `fetchGroupPreviewByToken` to load group info (name, member count, avatar)
- Add a debounce (500ms) to prevent excessive API calls during typing
- Display a preview card (same style as ChatPage's search preview) showing group name, member count, and avatar
- Show a loading spinner while fetching
- Show an error message if the link is invalid/expired

## 2. Implementation Checklist

### Phase 1: Announcement Popup De-duplication (Bugs 1 & 3) [AI]

- [x] 1.1 In `ChatPage.tsx` ChatDetail component: Change `announcementShownRef` from `Set<string>` to `Map<string, string>` (key = `chat.id`, value = `announcement_at` timestamp). Update the effect to only show popup when the new `announcement_at` is strictly newer than the stored value.
- [x] 1.2 In the same effect: Add guard to skip showing announcement popup if `groupDetail.announcement_by` equals current `walletAddress` (the author who just edited should not see popup).
- [x] 1.3 In `GroupAnnouncementModal.tsx`: Change the "Confirm" button `onClick` to call `handleClose()` instead of calling `markAnnouncementRead` + `onClose()` separately. This prevents double `markAnnouncementRead` DB write.
- [x] 1.4 Run `git diff` to verify changes.
- [x] 1.5 Run `npx tsc --noEmit` to verify no type errors.

### Phase 2: Keyboard Avoidance for Drawers (Bugs 2 & 4) [AI]

- [x] 2.1 Create new hook `hooks/use-drawer-keyboard.ts` that:
  - On Capacitor native: listens to `Keyboard.keyboardWillShow` / `keyboardDidHide` events
  - On web: listens to `window.visualViewport` `resize` event
  - Returns `keyboardHeight` state (number, default 0)
  - Cleans up listeners on unmount
- [x] 2.2 Modify `components/ui/drawer.tsx` DrawerContent: use the `useDrawerKeyboard` hook to get `keyboardHeight`, apply `transform: translateY(-keyboardHeight)` when `keyboardHeight > 0`.
- [x] 2.3 Remove the manual `onFocus` → `scrollIntoView` workaround from `JoinGroupModal.tsx` input (now handled by DrawerContent).
- [x] 2.4 Remove the manual `onFocus` → `scrollIntoView` workaround from `GroupAnnouncementModal.tsx` textarea (now handled by DrawerContent).
- [x] 2.5 Run `git diff` to verify changes.
- [x] 2.6 Run `npx tsc --noEmit` to verify no type errors.

### Phase 3: Invite Link Preview in JoinGroupModal (Bug 5) [AI]

- [x] 3.1 In `JoinGroupModal.tsx`: Add state variables for `invitePreview`, `loadingPreview`, and `inviteLinkInvalid`.
- [x] 3.2 Add `useEffect` watching `input` value: extract token via `parseInviteToken`, if found call `fetchGroupPreviewByToken` with 500ms debounce. Handle success/failure/cancel.
- [x] 3.3 Add preview card UI below the input field (matching ChatPage's search preview style): group icon, name, member count.
- [x] 3.4 Add loading spinner state while preview is fetching.
- [x] 3.5 Add invalid/expired link error message display.
- [x] 3.6 Wire the preview card's "Join" button to existing `handleJoin` logic (via main Join button).
- [x] 3.7 Run `git diff` to verify changes.
- [x] 3.8 Run `npx tsc --noEmit` to verify no type errors.

### Phase 4: Verification [AI]

- [x] 4.1 Run `git diff --stat` to verify all modified files match the plan.
- [x] 4.2 Run `cd frontend && npx tsc --noEmit` for final type check.
- [x] 4.3 Verify testchecklist items against actual implementation.

## 3. Unit Tests

### Test: Announcement popup de-duplication
- Verify that when `announcement_at` changes but represents the same announcement (Realtime echo), the popup does NOT re-open.
- Verify that the popup does NOT open for the user who just published the announcement.
- Verify that when a genuinely NEW announcement is published by another user, the popup DOES open.

### Test: markAnnouncementRead not called twice
- Verify that clicking "Confirm" in GroupAnnouncementModal only calls `markAnnouncementRead` once (via `handleClose`).

### Test: Invite preview in JoinGroupModal
- Verify that when a valid invite token is entered, `fetchGroupPreviewByToken` is called after debounce.
- Verify that the preview card displays group name and member count.
- Verify that an invalid token shows an error message.
- Verify that clearing the input clears the preview.

### Test: Keyboard avoidance in Drawer
- Verify that when the keyboard opens, the DrawerContent adjusts its position upward.
- Verify that when the keyboard closes, the adjustment resets to 0.
- Verify that on non-Capacitor platforms, the visualViewport fallback works.

## 4. Files to Modify

| File | Changes |
|------|---------|
| `components/ui/drawer.tsx` | Add keyboard avoidance to DrawerContent |
| `components/chat/GroupAnnouncementModal.tsx` | Fix "Confirm" button to use `handleClose()` |
| `components/chat/JoinGroupModal.tsx` | Add invite preview logic + preview card UI |
| `components/pages/ChatPage.tsx` | Fix `announcementShownRef` de-duplication logic + skip popup for author |
| `hooks/use-drawer-keyboard.ts` | New hook for Drawer keyboard height detection |
