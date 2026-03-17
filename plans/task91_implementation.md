# Task 91 Implementation Document — Dissolved Group Input Disable + Join Request Red Dot Notifications

## 1. Task Requirements

### Issue 1: Dissolved group members can still send messages
Currently, when a group is dissolved by the owner, other members who still have the chat open can continue typing and sending messages until the Realtime DELETE event arrives and removes the chat from the store. The input should be disabled and show "This group has been dissolved" (该群已解散).

**Root cause:** When the group is deleted from the DB, other members detect it via Realtime `DELETE` event on the `groups` table, which removes the chat from `store.chats`. The ChatDetail component detects this via `useEffect` (ChatPage.tsx:284-291) and shows an alert modal. However, there is a timing gap: between dissolution and Realtime delivery, users can still type and send messages. Additionally, the `sendGroupPushMessage` action only checks mute status and chat existence in local store — it does not verify the group still exists in the DB.

**Fix approach:**
1. When `removedAlert` is set to `'dissolved'` or `'removed'`, replace the chat input bar with a disabled notice message (same pattern as mute display at line 876-883).
2. Add a server-side guard in `sendGroupPushMessage`: before actually sending to Supabase, the send will fail naturally if the group doesn't exist (the message insert references a non-existent group). The error is already caught and shows "Send failed" toast. This is acceptable as a secondary guard.
3. The primary UX fix is: once the ChatDetail detects the chat is gone from `allChats`, disable the input immediately.

### Issue 2: Join request approval notification red dots
Admins/owners need to see pending join request notifications in three locations:
1. **Chat list** — Group card in the chat sidebar should show a red dot/badge when there are pending join requests (only visible to admins/owners)
2. **Group chat header** — The avatar/title bar area should show a red dot indicating pending management tasks
3. **Group management page** — "Join Requests" (入群审批) row should show a red badge (already implemented at GroupInfoPanel.tsx:590-599)

**Root cause of missing notifications:** `pendingRequestCounts` is never bulk-loaded during `initChat()`. It only gets populated via:
- Realtime INSERT events on `group_join_requests` (store.ts:1207-1222) — only catches new requests arriving after chat init
- Opening group management panel individually (store.ts:1910-1920) — only loaded per-group on demand

**Fix approach:**
1. Add a new function `fetchAllPendingRequestCounts(groupIds, walletAddress)` in `group-management.ts` that batch-queries pending request counts for all groups where the user is admin/owner
2. Call this function during `initChat()` after loading groups, to populate `pendingRequestCounts` at startup
3. Add red dot badge to group cards in chat list (ChatPage.tsx:~1404-1421) — only shown when user is admin/owner of that group AND `pendingRequestCounts[groupId] > 0`
4. Add red dot badge to group chat header (ChatPage.tsx:~630-693) — shown on the avatar area when user is admin/owner AND pending count > 0
5. The GroupInfoPanel "Join Requests" row already has the red badge (line 590-599) — no change needed there

## 2. Implementation Checklist

### Phase 1: Data Layer (can be done in parallel)

- [x] **1.1** [AI] Add `admins?: string[]` to `GroupRow` interface in `frontend/lib/chat.ts`
- [x] **1.2** [AI] Add `fetchAllPendingRequestCounts(groupIds: string[])` function to `frontend/lib/group-management.ts`
  - Query `group_join_requests` with `.in('group_id', groupIds).eq('status', 'pending')`, count client-side by group_id
- [x] **1.3** [AI] Add `myAdminGroupIds: string[]` field to store interface and initial state in `frontend/lib/store.ts`
  - Add to interface definition, initial state `[]`, and all reset points (switchWallet, logout, etc.)

### Phase 2: Store Logic

- [x] **2.1** [AI] In `initChat()` (`frontend/lib/store.ts`), after loading groups:
  - Compute `adminGroupIds` from groups data: groups where `creator === me || (admins || []).includes(me)`
  - Call `fetchAllPendingRequestCounts(adminGroupIds)` and set both `myAdminGroupIds` and `pendingRequestCounts` in store
- [x] **2.2** [AI] In Realtime `groups` UPDATE handler (store.ts:~1158-1191), update `myAdminGroupIds` when admin list changes

### Phase 3: UI Changes (can be done in parallel)

- [x] **3.1** [AI] **Dissolved/removed input disable** (`frontend/components/pages/ChatPage.tsx` ChatDetail):
  - Before the mute check (line ~876), add `removedAlert` check
  - If `removedAlert === 'dissolved'` → show disabled notice with `t('group.groupDissolved', locale)`
  - If `removedAlert === 'removed'` → show disabled notice with `t('group.removedFromGroup', locale)`
  - Use same styling as mute notice: `flex items-center justify-center py-2.5 text-sm text-muted-foreground`
- [x] **3.2** [AI] **Red dot on chat list** (`frontend/components/pages/ChatPage.tsx` ChatPage):
  - Add `pendingRequestCounts` and `myAdminGroupIds` to store selector (line ~1065)
  - In chat list item rendering (line ~1404-1421), add red dot for group chats where `myAdminGroupIds.includes(chat.id) && pendingRequestCounts[chat.id] > 0`
  - Red dot: small circle indicator (8x8px, bg-red-500) on the group avatar
- [x] **3.3** [AI] **Red dot on group chat header** (`frontend/components/pages/ChatPage.tsx` ChatDetail):
  - Add `pendingRequestCounts` to ChatDetail store selectors
  - In header section (line ~629-693), add red dot on group avatar when admin/owner AND `pendingRequestCounts[chat.id] > 0`
  - Use `groupDetail` to check admin/owner status
  - Red dot: small circle (w-2.5 h-2.5 bg-red-500) positioned on top-right of avatar

### Phase 4: TypeScript Check

- [x] **4.1** [AI] Run `cd frontend && npx tsc --noEmit` to verify no type errors (only pre-existing test file errors)

### Phase 5: Verification

- [x] **5.1** [AI] Run `git diff --stat` to verify all changed files match expected list
- [ ] **5.2** [AI] Run testchecklist verification scripts

## 3. Unit Tests

### Test: Dissolved group input disabled
- **T1.1**: When `removedAlert` is `'dissolved'`, the chat input area should show a disabled notice instead of the text input
- **T1.2**: When `removedAlert` is `'removed'`, the chat input area should show a disabled notice
- **T1.3**: The disabled notice text should match `t('group.groupDissolved', locale)` for dissolved groups

### Test: Pending request count initialization
- **T2.1**: `fetchAllPendingRequestCounts` returns correct counts for groups where user is admin/owner
- **T2.2**: `fetchAllPendingRequestCounts` returns 0 for groups where user is regular member
- **T2.3**: After `initChat()`, `pendingRequestCounts` is populated for admin/owner groups

### Test: Red dot badge display logic
- **T3.1**: Chat list group card shows red dot when `pendingRequestCounts[groupId] > 0` and user is admin/owner
- **T3.2**: Chat list group card does NOT show red dot when user is regular member
- **T3.3**: Group chat header shows red dot when pending count > 0 and user is admin/owner
- **T3.4**: Red dot disappears when all requests are handled (count becomes 0)

### Test: Realtime updates
- **T4.1**: When a new join request arrives via Realtime INSERT, `pendingRequestCounts` increments
- **T4.2**: When a request is approved/rejected via Realtime UPDATE, `pendingRequestCounts` decrements
- **T4.3**: Red dot updates immediately without page refresh

## 4. Detailed Implementation

### 4.1 Issue 1 — Disable input in dissolved groups

**File: `frontend/components/pages/ChatPage.tsx`**

In the ChatDetail component, the input bar section (lines 874-934) currently checks `myMute || isMuteAll` to decide whether to show the input or a mute notice. Add an additional check for `removedAlert`:

```
Condition priority:
1. removedAlert === 'dissolved' or 'removed' → show "This group has been dissolved" / "You have been removed" notice
2. myMute || isMuteAll → show mute notice
3. Otherwise → show normal input
```

The notice should use the same styling as the mute notice (line 877) for visual consistency.

### 4.2 Issue 2 — Batch load pending request counts

**File: `frontend/lib/group-management.ts`**

Add new function:
```typescript
export async function fetchAllPendingRequestCounts(groupIds: string[]): Promise<Record<string, number>>
```

This function queries `group_join_requests` table for all given group IDs where `status = 'pending'`, grouped by `group_id`, returning a count map.

Implementation approach: Use a single Supabase query with `.in('group_id', groupIds).eq('status', 'pending')` and count client-side by group_id, since Supabase JS client doesn't support GROUP BY directly.

### 4.3 Issue 2 — Load counts during initChat

**File: `frontend/lib/store.ts`**

In `initChat()`, after loading groups (line 860-864), determine which groups the user is admin/owner of. Then call `fetchAllPendingRequestCounts(adminGroupIds)` and set `pendingRequestCounts` in the store.

To determine admin/owner status: `groups` data from `fetchGroups` returns `GroupRow` which includes `creator`. But `admins` array is only in `GroupDetail` (fetched via `fetchGroupDetail`). The `groups` table has `creator` and `admins` columns. We can use the `groups` data already fetched to check `creator === me || admins.includes(me)`.

Wait — `GroupRow` interface only has `id, created_at, name, creator, members`. It doesn't include `admins`. We need to either:
- Option A: Extend `fetchGroups` to also select `admins` column
- Option B: Use a separate query on the groups table for admin status

Option A is simpler and more efficient. We'll add `admins` to the `GroupRow` interface and the `fetchGroups` query (it already does `select('*')` so the data is already returned, just not typed).

### 4.4 Issue 2 — Red dot on chat list group cards

**File: `frontend/components/pages/ChatPage.tsx`**

In the `ChatPage` component (outer), add `pendingRequestCounts` to the store selector (line 1065). Also need to know which groups the user is admin/owner of — this requires the `activeGroupDetail` or the groups' creator/admins data.

Since `activeGroupDetail` is only loaded per-group on demand, we need an alternative. We can:
- Store a `myAdminGroups: Set<string>` computed during `initChat()` that lists group IDs where user is admin/owner
- Or use the groups data that's already available

Best approach: Add `myAdminGroupIds: string[]` to the store, populated during `initChat()` from the groups data. This avoids needing to load full GroupDetail for every group.

In the chat list item rendering (line 1404-1421), add a red dot badge after the unread count badge, but only for groups where `myAdminGroupIds.includes(chat.id) && pendingRequestCounts[chat.id] > 0`.

### 4.5 Issue 2 — Red dot on group chat header

**File: `frontend/components/pages/ChatPage.tsx`**

In the ChatDetail component header section (line 629-693), add a small red dot indicator on the group avatar or next to the title when:
- `chat.type === 'group'`
- User is admin/owner (check `groupDetail?.creator === walletAddress.toLowerCase() || groupDetail?.admins?.includes(walletAddress.toLowerCase())`)
- `pendingRequestCounts[chat.id] > 0` (from store)

The red dot should be small (like the online indicator) to indicate there are management tasks pending.

### 4.6 i18n strings needed

- `group.groupDissolved` — already exists: "群聊已解散" / "This group has been dissolved"
- `group.removedFromGroup` — already exists: need to verify
- No new i18n strings needed for red dot (it's a visual indicator without text)

### 4.7 Verification: GroupRow admins field

Need to verify that the `groups` table actually has an `admins` column. Check the Supabase schema or existing code.

From `GroupDetail` interface (group-management.ts:9-23), `admins` is listed as `string[]`. The `fetchGroupDetail` function queries `groups` table with `select('*')`. Since `fetchGroups` also does `select('*')`, the `admins` data is already returned — it's just not typed in `GroupRow`.

**Action**: Add `admins?: string[]` to the `GroupRow` interface in `chat.ts`.

## 5. Audit Findings

### Round 1 — Functionality completeness
- Issue 1 (dissolved input) — simple conditional UI change, fully covers the requirement
- Issue 2 (red dots) — covers all 3 locations specified in requirements. GroupInfoPanel already done. Need chat list + chat header.
- Initial load of pending counts is the critical missing piece — addressed by `fetchAllPendingRequestCounts`

### Round 2 — Change impact
- `removedAlert` is only used in ChatDetail component. Adding it to the input condition has no side effects on other code.
- `pendingRequestCounts` Realtime handler (line 1207-1222) increments for ALL group members, not just admins. This is harmless — UI filters by admin status.
- Adding `admins` to `GroupRow` interface is safe — `fetchGroups` already does `select('*')`, so the data is returned. We're just adding the type.
- `myAdminGroupIds` is new store field — no existing consumers, no conflict.
- Must update `myAdminGroupIds` when Realtime `groups` UPDATE arrives (admin added/removed), to keep it in sync.

### Round 3 — Runtime behavior
- Realtime subscriptions for `group_join_requests` INSERT/UPDATE already handle count sync correctly.
- `initChat()` initial load fills the gap — counts are loaded once at startup.
- Edge case: user becomes admin while app is running → Realtime `groups` UPDATE should update `myAdminGroupIds`. This will be handled by hooking into the existing Realtime handler at line 1158-1191.
- Edge case: app reconnects after network loss → Realtime will replay missed events, counts may be inaccurate. However, next `initChat()` or `openGroupManagement()` will correct them. Acceptable.

### Round 4 — Cross-cutting review
- No security risk — red dots are client-side UI only.
- No data mutation — all changes are read-only display logic except the new `fetchAllPendingRequestCounts` query.
- Performance: one additional Supabase query during `initChat()`. Since it's batched for all admin groups, impact is minimal.
- The dissolved group input check uses existing `removedAlert` state — no new state management needed.

