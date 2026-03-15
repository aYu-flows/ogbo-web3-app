# Task85 Test Checklist — Dissolve Group Blank Page + Chinese IME Input Detection

## How to Use This Checklist

Each test item has **two checkboxes**:
- **[Doc]** — Check after reviewing the implementation document to confirm it covers this scenario
- **[Impl]** — Check after actual implementation to confirm this works correctly in the app

Format: `- [ ] [Doc] [ ] [Impl] description`

---

## A. Dissolve Group — Blank Page Fix

### A1. Core Dissolution Flow (Group Owner)

- [x] [Doc] [x] [Impl] Group owner dissolves group → chat list page appears immediately (no blank page)
- [x] [Doc] [x] [Impl] After dissolution, `selectedChat` resets to `null` — chat list panel is visible on mobile
- [x] [Doc] [x] [Impl] After dissolution, no ChatDetail component is rendered for the dissolved group
- [x] [Doc] [x] [Impl] Dissolution system message / alert is shown before the chat is removed (user sees confirmation)

### A2. Edge Cases — Dissolution

- [x] [Doc] [x] [Impl] Group owner dissolves group while offline / poor network → no blank page on reconnect
- [x] [Doc] [x] [Impl] User force-kills app during dissolution → on next launch, dissolved group does NOT persist in chat list
- [x] [Doc] [x] [Impl] If another member is viewing the group when owner dissolves → member sees dissolution notice and is returned to chat list (no blank page)
- [x] [Doc] [x] [Impl] Dissolve group while group info panel is open → panel closes, chat list visible

### A3. Leave Group (Same Pattern)

- [x] [Doc] [x] [Impl] Non-owner member leaves group → returned to chat list immediately (no blank page)
- [x] [Doc] [x] [Impl] After leaving group, `selectedChat` resets to `null`
- [x] [Doc] [x] [Impl] Leave group while on mobile view → chat list panel becomes visible

### A4. Realtime Sync — Other Members

- [x] [Doc] [x] [Impl] When group is dissolved by owner, other online members receive Realtime update → chat is removed from their list without blank page
- [x] [Doc] [x] [Impl] When a member is kicked from group, same auto-deselect logic applies → no blank page

---

## B. Chinese IME Input Detection Fix

### B1. Chat Input — Send Button Toggle

- [x] [Doc] [x] [Impl] Type Chinese text via IME in chat input → send button icon appears immediately after composition ends (no extra keystroke needed)
- [x] [Doc] [x] [Impl] Type Chinese text, then delete all text → microphone icon returns immediately
- [x] [Doc] [x] [Impl] Type mixed Chinese + English text → send button shows correctly throughout
- [x] [Doc] [x] [Impl] Paste Chinese text into chat input → send button appears immediately
- [x] [Doc] [x] [Impl] Type Chinese text and press Enter to send → message sends correctly with full Chinese content

### B2. Chat Input — Edge Cases

- [x] [Doc] [x] [Impl] Start IME composition, then cancel (press Escape) → input state remains consistent, mic icon stays
- [x] [Doc] [x] [Impl] Rapid repeated Chinese compositions (type, confirm, type, confirm) → send button toggles correctly each time
- [x] [Doc] [x] [Impl] Type Chinese text via voice input / dictation → send button appears
- [x] [Doc] [x] [Impl] Auto-fill / predictive text selection on mobile → input detection works

### B3. useIMEInput Hook — All Consumers

The `useIMEInput` hook is used by multiple components. After fix, all should correctly detect Chinese IME input:

- [x] [Doc] [x] [Impl] ChatPage search box — Chinese search query is detected and triggers search after composition ends
- [x] [Doc] [x] [Impl] MarketPage search box — Chinese input detected correctly
- [x] [Doc] [x] [Impl] DiscoverPage search box — Chinese input detected correctly
- [x] [Doc] [x] [Impl] GroupMemberList search — Chinese member name search works
- [x] [Doc] [x] [Impl] GroupInfoPanel name edit — Chinese group name is accepted after IME composition
- [x] [Doc] [x] [Impl] GroupInfoPanel nickname edit — Chinese nickname is accepted after IME composition
- [x] [Doc] [x] [Impl] InviteFriendsToGroupModal search — Chinese search works
- [x] [Doc] [x] [Impl] GroupAnnouncementModal text input — Chinese announcement text is accepted
- [x] [Doc] [x] [Impl] CreateGroupModal name input — Chinese group name is accepted
- [x] [Doc] [x] [Impl] CreateGroupModal search input — Chinese search for members works
- [x] [Doc] [x] [Impl] AddFriendModal search — Chinese search works

### B4. Other IME Languages

- [x] [Doc] [x] [Impl] Japanese IME input — composition detected correctly in chat input
- [x] [Doc] [x] [Impl] Korean IME input — composition detected correctly in chat input
- [x] [Doc] [x] [Impl] Japanese/Korean IME in useIMEInput consumers — works correctly

### B5. Non-IME Input (Regression Check)

- [x] [Doc] [x] [Impl] English text input in chat — send button still toggles correctly (no regression)
- [x] [Doc] [x] [Impl] English text input in all search boxes — still works correctly
- [x] [Doc] [x] [Impl] Emoji input — detected correctly
- [x] [Doc] [x] [Impl] Numbers and special characters — detected correctly

---

## C. End-to-End Smoke Verification

### C1. Data Link Consistency

- [x] [Doc] [x] [Impl] After dissolving group, the group chat entry is removed from local store AND does not reappear after app restart
- [x] [Doc] [x] [Impl] After dissolving group, Supabase Realtime properly notifies all group members
- [x] [Doc] [x] [Impl] `hasText` state in chat input stays in sync with actual input DOM value at all times (no stale state)
- [x] [Doc] [x] [Impl] `deferredValue` in useIMEInput stays in sync with actual input value after composition ends

### C2. Permission & Role Boundary

- [x] [Doc] [x] [Impl] Only group owner can dissolve — non-owner does not see the dissolve option
- [x] [Doc] [x] [Impl] Group admin (non-owner) leaving group → same blank-page fix applies

### C3. Platform Compatibility

- [x] [Doc] [x] [Impl] Bug A fix works on Android Capacitor WebView
- [x] [Doc] [x] [Impl] Bug A fix works on iOS Capacitor WebView
- [x] [Doc] [x] [Impl] Bug A fix works on Web browser (Chrome/Safari)
- [x] [Doc] [x] [Impl] Bug B fix works on Android Capacitor WebView (primary target)
- [x] [Doc] [x] [Impl] Bug B fix works on iOS Capacitor WebView
- [x] [Doc] [x] [Impl] Bug B fix works on Web browser desktop (Chrome/Firefox/Safari)

---

## D. Interaction Quality Verification

### D1. Input Interaction Compatibility (IME)

- [x] [Doc] [x] [Impl] During IME composition (underlined text visible), pressing the send button does NOT send partial/uncommitted text
- [x] [Doc] [x] [Impl] During IME composition, switching focus away from input and back does not lose composed text
- [x] [Doc] [x] [Impl] `requestAnimationFrame` fallback correctly handles the Android "onChange before compositionEnd" timing issue
- [x] [Doc] [x] [Impl] Native DOM `input` event listener on chat input does not conflict with React synthetic `onInput` handler

### D2. Operation Feedback (Dissolve)

- [x] [Doc] [x] [Impl] After dissolve confirmation, user sees immediate feedback (toast or redirect) — no silent blank state
- [x] [Doc] [x] [Impl] Chat list updates immediately after dissolution — dissolved group is gone from list
- [x] [Doc] [x] [Impl] Unread badge count updates correctly after group removal (total unread decremented)
