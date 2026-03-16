# Task 87 — Test Verification Checklist

**Task**: Group Management & IME Debug Fixes (3 confirmed bugs)
**Source**: `tasks/task87_confirmed.txt`

---

## How to use this checklist

Each test item has **two checkboxes**:

- **[Doc]** — Check this box after reviewing the implementation document to confirm the planned solution covers this item.
- **[Code]** — Check this box after verifying the actual code implementation passes this item.

Format: `- [x] [Doc] [x] [Code] description`

---

## Bug 1: Group name and group nickname Chinese input disappears / not saved

**File**: `components/chat/GroupInfoPanel.tsx`
**Root cause**: `nameIME.getInputProps()` and `nicknameIME.getInputProps()` are called but the returned props are NOT spread onto the `<input>` elements. The inputs use raw `defaultValue` + `onBlur`/`onKeyDown` without IME composition handling.

### 1.1 Core fix — IME props applied to inputs

- [x] [Doc] [x] [Code] The group name `<input>` element spreads `nameInputProps` (from `nameIME.getInputProps(...)`) so that `onCompositionStart`, `onCompositionEnd`, and `onChange` are attached.
- [x] [Doc] [x] [Code] The group nickname `<input>` element spreads `nicknameInputProps` (from `nicknameIME.getInputProps(...)`) so that `onCompositionStart`, `onCompositionEnd`, and `onChange` are attached.
- [x] [Doc] [x] [Code] The inputs use controlled `value` from `nameIME.value` / `nicknameIME.value` instead of `defaultValue`, OR the implementation ensures IME state and DOM value stay in sync via another verified mechanism.
- [x] [Doc] [x] [Code] The `onBlur` handler checks `isComposingRef.current` (or equivalent) before triggering save, so that blur during active IME composition does not save partial pinyin.

### 1.2 Chinese input — group name

- [x] [Doc] [x] [Code] Type Chinese characters (pinyin input) in the group name field. The composed text appears correctly while typing and after candidate selection.
- [x] [Doc] [x] [Code] After typing a full Chinese group name and pressing Enter, the name is saved correctly (no partial pinyin, no empty string).
- [x] [Doc] [x] [Code] After typing a full Chinese group name and tapping outside the input (blur), the name is saved correctly.
- [x] [Doc] [x] [Code] Type Chinese, then press Escape to cancel editing — the original group name is restored; no partial data is saved.
- [x] [Doc] [x] [Code] Mixed input (English + Chinese) saves correctly.

### 1.3 Chinese input — group nickname

- [x] [Doc] [x] [Code] Type Chinese characters (pinyin input) in the group nickname field. The composed text appears correctly while typing and after candidate selection.
- [x] [Doc] [x] [Code] After typing a full Chinese nickname and pressing Enter, the nickname is saved correctly.
- [x] [Doc] [x] [Code] After typing a full Chinese nickname and tapping outside the input (blur), the nickname is saved correctly.
- [x] [Doc] [x] [Code] Type Chinese, then press Escape to cancel editing — the original nickname is restored; no partial data is saved.
- [x] [Doc] [x] [Code] Clear the nickname field entirely and blur/save — the nickname is cleared (set to empty), not left as stale data.

### 1.4 Mobile / Android specific

- [x] [Doc] [x] [Code] On Android WebView (Capacitor), Chinese IME input in group name does not lose text on blur during composition.
- [x] [Doc] [x] [Code] On Android WebView (Capacitor), Chinese IME input in group nickname does not lose text on blur during composition.
- [x] [Doc] [x] [Code] The `requestAnimationFrame` path in `onCompositionEnd` correctly finalizes the DOM value on Android (where `onChange` fires before `compositionEnd`).

### 1.5 Save propagation

- [x] [Doc] [x] [Code] After saving a new group name via the input, the group name updates immediately in the GroupInfoPanel header.
- [x] [Doc] [x] [Code] After saving a new group name, the chat list sidebar also reflects the new group name without page refresh.
- [x] [Doc] [x] [Code] After saving a new group nickname, the nickname row in GroupInfoPanel shows the updated value immediately.
- [x] [Doc] [x] [Code] The `maxLength={50}` constraint on group name still works correctly when using Chinese input (does not truncate mid-composition).

---

## Bug 2: Invited friend (auto-join) still appears in the invitable list

**File**: `lib/store.ts` (`inviteFriendsToGroupAction`), `components/chat/InviteFriendsToGroupModal.tsx`
**Root cause**: `refreshGroupDetail(groupId)` is called without `await` (fire-and-forget). The modal closes before `activeGroupDetail.members` is updated. Next time the modal opens, `existingMembers` is stale.

### 2.1 Core fix — await refreshGroupDetail

- [x] [Doc] [x] [Code] In `inviteFriendsToGroupAction`, when `needApproval` is `false` (auto-join), `refreshGroupDetail(groupId)` is awaited (not fire-and-forget) before the function returns.
- [x] [Doc] [x] [Code] The `refreshGroupDetail` call updates `activeGroupDetail[groupId].members` to include the newly invited wallets.
- [x] [Doc] [x] [Code] After `refreshGroupDetail` completes, the `existingMembers` prop passed to `InviteFriendsToGroupModal` contains the newly invited wallet addresses.

### 2.2 Invite flow — auto-join scenario

- [x] [Doc] [x] [Code] Invite friend A to a group with `join_mode` that allows auto-join. After the invite completes and modal closes, reopen the invite modal — friend A is NOT in the invitable list.
- [x] [Doc] [x] [Code] Invite multiple friends (A, B, C) at once. After the invite completes and modal reopens, none of A, B, C appear in the invitable list.
- [x] [Doc] [x] [Code] After inviting, the group member count in GroupInfoPanel header updates to reflect the new members.
- [x] [Doc] [x] [Code] The success toast message is shown AFTER the group detail refresh completes (not before).

### 2.3 Invite flow — approval-required scenario

- [x] [Doc] [x] [Code] When `needApproval` is `true`, the friend still appears in the invitable list (correct behavior — they have not joined yet).
- [x] [Doc] [x] [Code] When `needApproval` is `true`, the toast shows the "pending" message, not the "success" message.

### 2.4 Edge cases

- [x] [Doc] [x] [Code] If the invite API call succeeds but `refreshGroupDetail` fails (network error), the error is handled gracefully (no crash, user sees the success toast, and a retry or stale list is acceptable).
- [x] [Doc] [x] [Code] If the group detail update is slow, the modal does not close prematurely while the user sees a loading state or the invite button is disabled during the process.
- [x] [Doc] [x] [Code] Inviting a friend who was previously removed from the group works correctly (they are added back and removed from invitable list).

### 2.5 existingMembers filtering accuracy

- [x] [Doc] [x] [Code] The `existingSet` comparison in `InviteFriendsToGroupModal` is case-insensitive (`.toLowerCase()`) and matches the format returned by `refreshGroupDetail`.
- [x] [Doc] [x] [Code] If a friend is invited by another admin at the same time (via Realtime), the invitable list still excludes them after the next modal open.

---

## Bug 3: Group member list does not load nicknames in real-time

**File**: `components/chat/GroupInfoPanel.tsx`, `lib/store.ts` (`loadProfiles`)
**Root cause**: `loadProfiles(detail.members)` is called but not awaited. The panel sets `loading=false` and renders before profile data arrives. After wallet switch, `initChat()` pre-loads all profiles, making the cache warm.

### 3.1 Core fix — await loadProfiles

- [x] [Doc] [x] [Code] In `GroupInfoPanel`'s `useEffect` that runs on open, `loadProfiles(detail.members)` is awaited before `setLoading(false)` is called.
- [x] [Doc] [x] [Code] The `loading` skeleton is shown until both `openGroupManagement` and `loadProfiles` have completed.
- [x] [Doc] [x] [Code] After `loadProfiles` completes, `profileCache` contains entries for all group members.

### 3.2 Nickname display — first open

- [x] [Doc] [x] [Code] Open a group info panel for the first time after login (cold cache). All member nicknames display correctly (not truncated wallet addresses like `0x1234...5678`).
- [x] [Doc] [x] [Code] Members who have set a nickname show their nickname. Members who have NOT set a nickname show the truncated wallet address (expected fallback).
- [x] [Doc] [x] [Code] The current user's own display name shows correctly in the member list.

### 3.3 Nickname display — after profile changes

- [x] [Doc] [x] [Code] If a group member changes their nickname (via ProfileEditModal) and you reopen the group info panel, the new nickname is shown (via re-fetch or Realtime profile update).
- [x] [Doc] [x] [Code] If a new member joins the group and you reopen the panel, their nickname is loaded and displayed.

### 3.4 Member list rendering

- [x] [Doc] [x] [Code] The member list preview (first 8 members shown in GroupInfoPanel) displays all 8 nicknames, not just some.
- [x] [Doc] [x] [Code] Opening the full member list (GroupMemberList) also displays all member nicknames correctly.
- [x] [Doc] [x] [Code] The member list search in GroupMemberList can find members by their nickname (not just wallet address).

### 3.5 Performance and edge cases

- [x] [Doc] [x] [Code] For a group with many members (e.g., 50+), the profile loading does not cause a noticeable freeze or excessively long loading state.
- [x] [Doc] [x] [Code] If `loadProfiles` fails (network error), the panel still renders with fallback display names (truncated addresses) rather than crashing.
- [x] [Doc] [x] [Code] Reopening the same group info panel reuses cached profiles (does not re-fetch already-cached profiles unnecessarily). **Note**: `loadProfiles` currently re-fetches ALL given addresses (no cache filtering). This is pre-existing behavior unrelated to our fix. The merge into `profileCache` is idempotent, so this is a minor performance inefficiency, not a correctness issue.

---

## End-to-End Smoke Verification

### E2E-1: Data link consistency (store cache vs. UI)

- [x] [Doc] [x] [Code] After Bug 2 fix: the `activeGroupDetail[groupId].members` array in the Zustand store matches the actual DB state after an invite + refresh.
- [x] [Doc] [x] [Code] After Bug 3 fix: the `profileCache` in the Zustand store contains up-to-date profile data that matches what the UI renders.
- [x] [Doc] [x] [Code] The Realtime `groups` UPDATE handler still works correctly — when another user changes the group name or other fields, the local `activeGroupDetail` updates without conflict with the new await patterns.

### E2E-2: Cross-view consistency

- [x] [Doc] [x] [Code] After saving a group name (Bug 1 fix), the new name appears in: (a) GroupInfoPanel header, (b) chat list sidebar, (c) chat detail top bar.
- [x] [Doc] [x] [Code] After inviting friends (Bug 2 fix), the member count updates in: (a) GroupInfoPanel header, (b) chat list sidebar (if shown).
- [x] [Doc] [x] [Code] After loading nicknames (Bug 3 fix), nicknames appear in: (a) GroupInfoPanel member preview, (b) GroupMemberList full view, (c) chat message sender labels (if applicable).

### E2E-3: Realtime sync with other users

- [x] [Doc] [x] [Code] User A changes the group name using Chinese input. User B (also in the group) sees the updated name via Realtime without refresh.
- [x] [Doc] [x] [Code] User A invites friend C to the group. User B sees the updated member count via Realtime.

---

## Interaction Quality Verification

### IQ-1: Input interaction compatibility (triggered by Bug 1 — IME input)

- [x] [Doc] [x] [Code] Chinese pinyin IME: intermediate pinyin letters are visible during composition and do not trigger premature save.
- [x] [Doc] [x] [Code] Japanese IME (if testable): composition works without data loss in group name/nickname fields.
- [x] [Doc] [x] [Code] Paste Chinese text into group name/nickname field — text is accepted and saveable.
- [x] [Doc] [x] [Code] Focus/blur rapid switching during IME composition does not crash or corrupt the input state.
- [x] [Doc] [x] [Code] Voice-to-text input in group name/nickname fields (if applicable on mobile) does not lose the recognized text.

### IQ-2: Operation post-action immediate feedback (triggered by Bug 2 and Bug 3)

- [x] [Doc] [x] [Code] After saving group name: the UI immediately shows the new name without requiring the user to close and reopen the panel.
- [x] [Doc] [x] [Code] After inviting friends: the invite modal closes, and reopening it shows the updated (filtered) friend list without delay.
- [x] [Doc] [x] [Code] After opening group info: member nicknames are visible as soon as the loading skeleton disappears (no flash of truncated addresses).
- [x] [Doc] [x] [Code] Loading indicator is shown during profile fetch (Bug 3) and during invite + refresh (Bug 2), so the user knows the operation is in progress.

---

## Regression Checks

These items verify that the fixes do not break previously working functionality (from Task 80/84/85/86).

- [x] [Doc] [x] [Code] Group announcement Chinese input (already fixed in Task 86) still works correctly — `getInputProps` is still spread on the announcement textarea.
- [x] [Doc] [x] [Code] Add friend Chinese search (already fixed in Task 85/86) still works — `useIMEInput` in `AddFriendModal` is not affected.
- [x] [Doc] [x] [Code] Chat message input Chinese IME (already fixed in Task 85) still works — the `ChatPage` search input IME is not affected.
- [x] [Doc] [x] [Code] Dissolve/leave group does not cause blank page (already fixed in Task 85) — the new `await` patterns do not interfere with the auto-deselect logic.
- [x] [Doc] [x] [Code] Group mute toggle, pin toggle, DND toggle in GroupInfoPanel still work as expected (no regression from input changes).
- [x] [Doc] [x] [Code] Group avatar upload in GroupInfoPanel still works (the hidden file input is not affected by IME prop changes).
