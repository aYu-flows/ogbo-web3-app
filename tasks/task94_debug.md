# Task 94 Debug Document

Date: 2026-03-18
Status: Fixed (pending user verification)

---

## Bug 1: Dissolved Group Members Can Still Send Messages

### Symptoms
- After a group is dissolved, members inside the chat can still type and send messages
- The "This group has been dissolved" notice and input disable happen, but too late

### Root Cause Analysis
Task93 added a guard in `handleSend` (line 427):
```tsx
if (removedAlert) return;
```
But `removedAlert` is React state set by a `useEffect`:
```tsx
useEffect(() => {
  if (chat.type !== 'group' || !walletAddress) return;
  const currentChat = allChats.find(c => c.id === chat.id);
  if (!currentChat) setRemovedAlert('dissolved');
}, [allChats, chat.id, chat.type, walletAddress]);
```
**Race condition**: When the group is dissolved, `allChats` updates (via Supabase Realtime), but `useEffect` runs asynchronously in the next React render cycle. If the user taps "send" between the store update and the effect execution, `removedAlert` is still `null` and the message goes through.

### Fix (Task94)
Added a **synchronous, real-time** guard in `handleSend` that reads directly from the Zustand store:
```tsx
if (chat.type === 'group') {
  const currentChats = useStore.getState().chats;
  if (!currentChats.some(c => c.id === chat.id)) {
    setRemovedAlert('dissolved');
    return;
  }
}
```
This bypasses the React render cycle entirely — `useStore.getState()` returns the latest store state at call time, not the last-rendered state.

### Verification Steps
1. Open a group chat with 2 members
2. Dissolve the group from the owner account
3. On the other member's device, try to send a message immediately
4. Expected: message is blocked, "This group has been dissolved" appears

---

## Bug 2: Chat Messages Shake/Jitter After Sending

### Symptoms
- After sending a message (private or group), existing messages visibly shake/jitter
- Happens on every send, both on mobile and desktop

### Root Cause Analysis
Task93 removed the `layout` prop from `motion.div`, but the shake persisted due to **two remaining issues**:

1. **`initial={{ opacity: 0, y: 10 }}`** — Each new message starts 10px below its final position and animates upward. Combined with `scrollIntoView({ behavior: "smooth" })` (which also animates scroll position), there are **two competing vertical animations** — the CSS transform `y: 10→0` and the smooth scroll — causing visible jitter.

2. **`exit={{ opacity: 0, height: 0, marginBottom: 0 }}`** — When `AnimatePresence` re-evaluates the list (new message added), the height-collapse exit animation triggers brief layout recalculation on all messages.

3. **`AnimatePresence` without `initial={false}`** — Without this prop, messages that are already present may replay entrance animations during certain re-renders.

### Fix (Task94)
Three changes to the message `motion.div`:
```diff
- <AnimatePresence>
+ <AnimatePresence initial={false}>

- initial={{ opacity: 0, y: 10 }}
- animate={{ opacity: 1, y: 0 }}
- exit={{ opacity: 0, height: 0, marginBottom: 0 }}
- transition={{ duration: 0.2 }}
+ initial={{ opacity: 0 }}
+ animate={{ opacity: 1 }}
+ transition={{ duration: 0.15 }}
```
- `initial={false}` — prevents already-present messages from replaying entrance animations
- Removed `y: 10` offset — eliminates vertical transform conflict with smooth scroll
- Removed `exit` animation — prevents height-collapse layout shifts
- Reduced duration 0.2s → 0.15s — snappier, less noticeable

### Verification Steps
1. Open any chat (private or group)
2. Send a text message
3. Expected: new message fades in smoothly, no shake on existing messages
4. Repeat in group chat to confirm same behavior

---

## Bug 3: Group Owner Can Leave Their Own Group

### Symptoms
- Group owner can swipe-left on a group chat in the list and tap delete to leave
- Owner leaving a group they created should be blocked

### Root Cause
- `leaveGroupAction` in store had no owner check — it just called `leaveGroup()` directly
- The swipe-to-delete action in ChatPage called `leaveGroupAction` without any guard
- GroupInfoPanel had a UI guard (disabled button for owners) but no store-level protection

### Fix (Task94 iteration 2)
- Added owner check in `leaveGroupAction` (store.ts): checks `activeGroupDetail[groupId]?.creator`, falls back to `fetchGroupDetail()` from Supabase if not cached. If user is owner, shows toast error and returns.
- Updated i18n text: "群主无法退出群聊，如需退出，请通过解散群聊来退出。"
- This protects ALL callers (swipe action, GroupInfoPanel, any future caller)

### Verification Steps
1. Open a group you own
2. Try swipe-left on the group in chat list → should show error toast
3. Open GroupInfoPanel → Leave button should be disabled with owner text

---

## Files Modified
- `frontend/components/pages/ChatPage.tsx` — Dissolution detection + message animation fixes
- `frontend/lib/store.ts` — Owner guard in leaveGroupAction
- `frontend/lib/i18n.ts` — Updated ownerCannotLeave text (zh + en)

## Iteration Log
| # | Date | Action | Result |
|---|------|--------|--------|
| 1 | 2026-03-18 | Applied initial fixes (store guard + animation) | User reports dissolved send still broken |
| 2 | 2026-03-18 | Added system message detection for dissolution (RLS fallback) + owner leave guard | Pending user test |
