# Task 91 Test Checklist — Dissolved Group Input Disable + Join Request Red Dot Notifications

> **Purpose**: This checklist serves two review rounds:
> - **Column 1 (Doc)**: Checked after the implementation document is finalized — verifies the doc covers the scenario.
> - **Column 2 (Impl)**: Checked after the actual code is implemented — verifies the feature works correctly in the running app.

---

## A. Issue 1 — Disable Chat Input for Dissolved / Removed Groups

### A1. Dissolved Group — Input Disabled

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | A1.1 When the group owner dissolves a group, members who have the chat open should see the input bar replaced by a disabled notice showing "This group has been dissolved" |
| [x] | [x] | A1.2 The disabled notice uses the same styling (layout, colors, font size) as the existing mute notice for visual consistency |
| [x] | [x] | A1.3 The notice text uses the i18n key `group.groupDissolved` and displays correctly in both Chinese and English locales |
| [x] | [x] | A1.4 After the Realtime DELETE event arrives and `removedAlert` is set to `'dissolved'`, the input bar is immediately replaced — no page refresh needed |
| [x] | [x] | A1.5 The alert modal (existing behavior) still appears as before to notify the user about dissolution |

### A2. Removed Member — Input Disabled

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | A2.1 When a member is removed from a group by admin/owner, the removed member's chat input is replaced by a disabled notice showing "You have been removed from the group" |
| [x] | [x] | A2.2 The notice text uses the correct i18n key (`group.removedFromGroup` or equivalent) and displays correctly in both locales |
| [x] | [x] | A2.3 The removed member cannot type or send any message after the removal event is detected |

### A3. Priority and Edge Cases

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | A3.1 Condition priority is correct: dissolved/removed check takes precedence over mute check — if both apply, the dissolved/removed notice is shown, not the mute notice |
| [x] | [x] | A3.2 If user is on the chat page when the group is dissolved, and then navigates away and back, the chat is either gone from the list or still shows the disabled notice (no stale input bar) |
| [x] | [x] | A3.3 If a user tries to send a message during the timing gap (after DB deletion but before Realtime event), the server-side insert fails gracefully and shows a "Send failed" toast — no crash or silent failure |
| [x] | [x] | A3.4 The dissolved/removed notice does not show a keyboard on mobile when tapped (it is not an editable element) |

---

## B. Issue 2 — Join Request Red Dot Notifications

### B1. Batch Load Pending Request Counts at Startup

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B1.1 A new function `fetchAllPendingRequestCounts` is implemented in `group-management.ts` that batch-queries pending join request counts for all provided group IDs |
| [x] | [x] | B1.2 The function queries `group_join_requests` table with `status = 'pending'` filter and groups results by `group_id` |
| [x] | [x] | B1.3 During `initChat()`, after loading groups, the system identifies groups where the user is admin/owner and calls `fetchAllPendingRequestCounts` for those groups |
| [x] | [x] | B1.4 After `initChat()` completes, `pendingRequestCounts` in the store is populated with correct counts for all admin/owner groups |
| [x] | [x] | B1.5 Groups where the user is a regular member (not admin/owner) do not have their pending counts fetched (no unnecessary queries) |

### B2. GroupRow Interface Update

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B2.1 The `GroupRow` interface in `chat.ts` includes the `admins` field (typed as `string[]` or `string[] | undefined`) |
| [x] | [x] | B2.2 Since `fetchGroups` already uses `select('*')`, the `admins` data is returned and correctly typed after the interface update |
| [x] | [x] | B2.3 Existing code that uses `GroupRow` is not broken by adding the optional `admins` field |

### B3. Red Dot on Chat List Group Cards

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B3.1 Group cards in the chat list show a red dot/badge when `pendingRequestCounts[groupId] > 0` AND user is admin/owner of that group |
| [x] | [x] | B3.2 Group cards do NOT show a red dot when the user is a regular member, even if there are pending requests |
| [x] | [x] | B3.3 Group cards do NOT show a red dot when pendingRequestCounts is 0 (all requests handled) |
| [x] | [x] | B3.4 The red dot is visually distinct from the unread message badge — they do not overlap or conflict |
| [x] | [x] | B3.5 The red dot appears on the correct group cards immediately after app startup (initial load, not just via Realtime) |

### B4. Red Dot on Group Chat Header

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B4.1 When inside a group chat, the header area (avatar/title bar) shows a small red dot when user is admin/owner AND `pendingRequestCounts[chatId] > 0` |
| [x] | [x] | B4.2 The red dot does NOT appear in the header for regular members |
| [x] | [x] | B4.3 The red dot size and style is appropriate (similar to an online indicator), not overly large or distracting |
| [x] | [x] | B4.4 The red dot is only shown for group chats (`chat.type === 'group'`), never for direct messages |

### B5. Group Management Page — Existing Red Badge (Regression)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B5.1 The existing "Join Requests" row in GroupInfoPanel still shows the red badge count correctly (no regression from this task's changes) |
| [x] | [x] | B5.2 The badge count on the management page matches the count shown on the chat list and header red dots |

### B6. Realtime Updates for Red Dots

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B6.1 When a new join request arrives via Realtime INSERT on `group_join_requests`, `pendingRequestCounts` increments for the corresponding group |
| [x] | [x] | B6.2 When a join request is approved via Realtime UPDATE (status changes from 'pending'), `pendingRequestCounts` decrements |
| [x] | [x] | B6.3 When a join request is rejected via Realtime UPDATE (status changes from 'pending'), `pendingRequestCounts` decrements |
| [x] | [x] | B6.4 The red dot on chat list and chat header updates immediately when counts change — no page refresh or navigation required |
| [x] | [x] | B6.5 After all pending requests are handled (approved or rejected), the red dot disappears from all three locations (chat list, chat header, management page) |

### B7. Admin Status Tracking

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | B7.1 The store tracks which groups the user is admin/owner of (via `myAdminGroupIds` or equivalent mechanism) |
| [x] | [x] | B7.2 When the user is promoted to admin via Realtime `groups` UPDATE, the admin tracking updates and red dots become visible for that group |
| [x] | [x] | B7.3 When the user is demoted from admin via Realtime `groups` UPDATE, the admin tracking updates and red dots stop showing for that group |

---

## C. End-to-End Smoke Verification

### C1. External Resource Reachability

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | C1.1 The `group_join_requests` table is queryable with `status = 'pending'` filter and `.in('group_id', [...])` under normal user RLS policies (not just admin/service-role) |
| [x] | [x] | C1.2 The new `fetchAllPendingRequestCounts` query succeeds with the authenticated user's Supabase client (row-level security allows reading pending requests for groups the user belongs to) |

### C2. Data Link Consistency

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | C2.1 The `pendingRequestCounts` loaded at startup via batch query matches the counts computed from individual Realtime events — no mismatch between initial load and incremental updates |
| [x] | [x] | C2.2 After approving/rejecting a request in the group management panel, the count in the store decrements correctly and all three red dot locations update consistently |
| [x] | [x] | C2.3 The Realtime INSERT handler for `group_join_requests` does not double-count requests that were already loaded during `initChat()` — if a request was pending at startup and a Realtime INSERT is replayed, the count should not become inflated |

### C3. Permission and Role Boundaries

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | C3.1 A group owner sees red dots on their groups in chat list and chat header when pending requests exist |
| [x] | [x] | C3.2 A group admin (non-owner) sees red dots on their groups in chat list and chat header when pending requests exist |
| [x] | [x] | C3.3 A regular group member does NOT see red dots, even if they somehow have `pendingRequestCounts` data for that group |
| [x] | [x] | C3.4 A user who is admin of Group A but regular member of Group B only sees red dots for Group A |

---

## D. Interaction Quality Verification

### D1. Operation Immediate Feedback (Section 2)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | D1.1 After dissolving a group, the dissolved notice appears immediately on other members' screens (within Realtime delivery latency) — no manual refresh needed |
| [x] | [x] | D1.2 After removing a member from a group, the removed member sees the disabled notice immediately — no manual refresh needed |
| [x] | [x] | D1.3 After approving/rejecting all pending requests for a group, the red dot disappears from chat list and header without leaving the page |

### D2. Visual Consistency (Section 3)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | D2.1 The dissolved/removed notice bar matches the existing mute notice in styling (background color, text color, padding, border-radius, font size) |
| [x] | [x] | D2.2 The red dot badge on chat list group cards is visually consistent with other badge indicators in the app (e.g., unread count badge) in terms of size, color, and positioning |
| [x] | [x] | D2.3 The red dot on the group chat header is small and unobtrusive, consistent with existing indicator patterns (e.g., online status dot) |

### D3. Realtime Event Deduplication (Section 6)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | D3.1 A single new join request arriving via Realtime does not trigger multiple increments to `pendingRequestCounts` (no duplicate event processing) |
| [x] | [x] | D3.2 After Realtime reconnection (network recovery or app resume), the pending request counts do not become inflated from replayed events |
| [x] | [x] | D3.3 The `removedAlert` state is set only once per dissolution event — a single DELETE event on `groups` does not trigger multiple alerts |

### D4. Toast / Notification Lifecycle (Section 7)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | D4.1 If a message send fails (timing gap scenario), the "Send failed" toast appears and auto-dismisses within the project's 1000ms toast duration |
| [x] | [x] | D4.2 Multiple rapid send failures do not cause toast stacking that never clears |

### D5. Account / Wallet Switch State Reset (Section 10)

| Doc | Impl | Test Item |
|-----|------|-----------|
| [x] | [x] | D5.1 After switching wallet, `pendingRequestCounts` is reset to `{}` (verified by existing store reset logic at wallet switch) |
| [x] | [x] | D5.2 After switching wallet, the admin/owner group tracking (`myAdminGroupIds` or equivalent) is reset and recalculated for the new wallet |
| [x] | [x] | D5.3 After switching wallet, red dots reflect the new wallet's admin groups and pending request counts — no carryover from old wallet |

---

## E. Summary

| Category | Item Count |
|----------|-----------|
| A. Dissolved/Removed Input Disable | 11 |
| B. Red Dot Notifications | 22 |
| C. E2E Smoke | 8 |
| D. Interaction Quality | 12 |
| **Total** | **53** |
