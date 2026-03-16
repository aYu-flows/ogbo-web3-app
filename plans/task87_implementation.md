# Task 87 — Group Management & IME Debug Fixes

## 1. Task Description

13 issues were reported about chat and group management features. After thorough codebase verification, **10 of 13 issues are already fixed** in previous tasks (Task80/84/85/86). **3 active bugs remain** and need fixing:

### Bug 1: Group name/nickname Chinese input disappears (Original Issue #10)

**Symptom:** When typing Chinese in the group name or group nickname input fields in GroupInfoPanel, the text disappears or is not saved correctly.

**Root Cause:** In `GroupInfoPanel.tsx`, two `useIMEInput` hooks are created at lines 96-97 (`nameIME`, `nicknameIME`), and `getInputProps()` is called at lines 353-354 (`nameInputProps`, `nicknameInputProps`). However, these props are **never applied** to the actual `<input>` elements:
- Group name input (lines 413-426): Uses raw `defaultValue` + `onBlur` + `onKeyDown` with no IME composition handlers
- Group nickname input (lines 501-514): Same pattern — no composition handlers

On Android/mobile, when the user blurs the input during active IME composition, `onBlur` fires `handleSaveName()` / `handleSaveNickname()` which reads `inputRef.current?.value`. At that moment, the DOM value may contain partial pinyin or be empty (if the IME cancelled on blur). Additionally, pressing Enter during IME candidate selection triggers the `onKeyDown` handler which saves partial input.

**Fix approach — detailed:**
1. Switch both inputs from uncontrolled (`defaultValue`) to controlled (`value={nameIME.value}` / `value={nicknameIME.value}`)
2. Apply composition handlers from `getInputProps`: `onCompositionStart`, `onCompositionEnd`, `onChange`
3. Merge custom `onKeyDown` with `getInputProps`'s `onKeyDown`:
   - `getInputProps` provides Enter key guard (blocks Enter during active composition, calls `onEnter` otherwise)
   - Custom handler adds Escape key to cancel edit mode
   - Combined: call `nameInputProps.onKeyDown(e)` first, then check for Escape
4. Guard `onBlur` save handlers with `isComposingRef.current` check + `requestAnimationFrame` delay
   - Reason: On Android, `blur` can fire before `compositionEnd`. The rAF delay lets `compositionEnd` fire first (setting `isComposingRef = false`), then the save proceeds correctly
   - If still composing after rAF (rare edge case), skip save — the composition was cancelled on blur
5. Keep reading from `inputRef.current?.value` in save handlers — controlled mode keeps DOM in sync with React state, so this still works. No changes to save handler logic.
6. The `ref={nameInputRef}` is still needed for the auto-focus `useEffect` at line 161

**Verification:** Both `nameIME.setValue(groupDetail.name)` (line 431) and `nicknameIME.setValue(myNickname || '')` (line 519) are already called when entering edit mode — initialization is correct.

### Bug 2: Invited friend still in invite list after auto-join (Original Issue #13)

**Symptom:** After inviting a friend to a group (auto-join mode), reopening the invite friends modal still shows the friend in the invitable list.

**Root Cause:** In `store.ts:2131-2134`, `inviteFriendsToGroupAction` calls `get().refreshGroupDetail(groupId).catch(() => {})` without `await`. The action returns and the modal closes before `activeGroupDetail[groupId].members` is updated. When the modal reopens, `existingMembers` prop still reflects the old member list.

**Fix approach:**
1. Change `get().refreshGroupDetail(groupId).catch(() => {})` to `await get().refreshGroupDetail(groupId).catch(() => {})`
2. This ensures the store's `activeGroupDetail.members` is updated before the action resolves

**Performance note:** `refreshChats()` at line 2132 is already awaited. Adding `await` to `refreshGroupDetail` makes them sequential. Both could run in parallel with `await Promise.all([...])` for better performance. However, since both are fast DB queries and this is an infrequent user action, sequential execution is acceptable and simpler.

**Change impact:** Only consumer is `InviteFriendsToGroupModal.tsx:71`. The toast at line 2135 fires after the await completes (slightly delayed — acceptable since the modal already has a loading spinner).

### Bug 3: Group member nicknames not loaded in real-time (Original Issue #4)

**Symptom:** In the group detail page, member nicknames show as truncated wallet addresses (`0x1234...5678`). They only display correctly after switching wallet address.

**Root Cause:** In `GroupInfoPanel.tsx:131-132`, `loadProfiles(detail.members)` is called as fire-and-forget (not awaited). The panel sets `loading=false` at line 135 and renders before profile data arrives. Member names render with whatever is in `profileCache` — for members not yet cached, truncated addresses are shown. After a wallet switch, `initChat()` pre-loads all group member profiles into cache, making the cache warm.

**Fix approach:**
1. Change the `.then()` callback to `async` and `await loadProfiles(detail.members)` before `setLoading(false)`
2. Add a second `cancelled` check after the await to prevent state updates on unmounted component:
   ```
   await loadProfiles(detail.members)
   if (cancelled) return  // prevent setLoading on unmounted component
   ```
3. `loadProfiles` has internal try/catch (store.ts:2317-2325), so it never throws — the panel will still render even on network failure, just with truncated addresses as fallback

---

## 2. Implementation Checklist

All items executed by AI unless marked otherwise.

### Phase 1: Bug 1 — GroupInfoPanel IME Fix

- [ ] **1.1** Modify group name `<input>` in `GroupInfoPanel.tsx` (lines 413-426):
  - Replace `defaultValue={groupDetail.name}` with `value={nameIME.value}`
  - Apply composition handlers: `onCompositionStart={nameInputProps.onCompositionStart}`, `onCompositionEnd={nameInputProps.onCompositionEnd}`, `onChange={nameInputProps.onChange}`
  - Merge `onKeyDown`: call `nameInputProps.onKeyDown(e)` + add Escape handler
  - Replace raw `onBlur` with rAF-guarded `onBlur` using `nameIME.isComposingRef`
  - Keep `ref={nameInputRef}` for auto-focus
  - Test: Verify `git diff` shows correct changes

- [ ] **1.2** Modify group nickname `<input>` in `GroupInfoPanel.tsx` (lines 501-514):
  - Replace `defaultValue={myNickname || ''}` with `value={nicknameIME.value}`
  - Apply composition handlers: `onCompositionStart={nicknameInputProps.onCompositionStart}`, `onCompositionEnd={nicknameInputProps.onCompositionEnd}`, `onChange={nicknameInputProps.onChange}`
  - Merge `onKeyDown`: call `nicknameInputProps.onKeyDown(e)` + add Escape handler
  - Replace raw `onBlur` with rAF-guarded `onBlur` using `nicknameIME.isComposingRef`
  - Keep `ref={nicknameInputRef}` for auto-focus
  - Test: Verify `git diff` shows correct changes

- [ ] **1.3** Run TypeScript check: `cd frontend && npx tsc --noEmit`

### Phase 2: Bug 2 — Invite List Refresh Fix (can run in parallel with Phase 1)

- [ ] **2.1** Modify `inviteFriendsToGroupAction` in `store.ts` (line 2133):
  - Change `get().refreshGroupDetail(groupId).catch(() => {})` to `await get().refreshGroupDetail(groupId).catch(() => {})`
  - Test: Verify `git diff` shows the added `await`

### Phase 3: Bug 3 — Member Nickname Loading Fix (can run in parallel with Phase 1)

- [ ] **3.1** Modify `GroupInfoPanel.tsx` useEffect (lines 121-141):
  - Change `.then((detail) =>` to `.then(async (detail) =>`
  - Change `loadProfiles(detail.members)` to `await loadProfiles(detail.members)`
  - Add `if (cancelled) return` after the await, before `setLoading(false)`
  - Test: Verify `git diff` shows correct changes

### Phase 4: Verification

- [ ] **4.1** Run `git diff --stat` to confirm only expected files are modified:
  - `components/chat/GroupInfoPanel.tsx`
  - `lib/store.ts`
- [ ] **4.2** Run TypeScript check: `cd frontend && npx tsc --noEmit` — zero errors
- [ ] **4.3** Write and run test script for Task 9 testchecklist verification

---

## 3. Unit Tests

### Test: GroupInfoPanel IME input props applied
- Verify that group name `<input>` receives `onCompositionStart`, `onCompositionEnd`, `onChange` handlers from `getInputProps`
- Verify that group nickname `<input>` receives the same handlers
- Verify that pressing Enter during active IME composition does NOT trigger save
- Verify that blurring during active composition does NOT trigger save with partial text
- Verify that Escape key still cancels edit mode

### Test: Invite list refresh after auto-join
- Verify that after `inviteFriendsToGroupAction` completes, `activeGroupDetail[groupId].members` includes the newly invited member
- Verify that `refreshGroupDetail` is awaited (not fire-and-forget)

### Test: Member nicknames loaded before panel renders
- Verify that `loadProfiles` is awaited before `loading` is set to `false`
- Verify that member nicknames are available in `profileCache` when the member grid renders
- Verify that `cancelled` check prevents state updates after unmount
