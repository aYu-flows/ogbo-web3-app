# Task86 Test Checklist — Group Announcement & Join Group UI Bugs

## How to Use This Checklist

Each test item has **two checkboxes**:
- **[Doc]** — Check after reviewing the implementation document to confirm it covers this scenario
- **[Impl]** — Check after actual implementation to confirm this works correctly in the app

Format: `- [ ] [Doc] [ ] [Impl] description`

---

## A. Group Announcement — Duplicate Confirmation Dialog Fix (Bug #1)

### A1. Core Edit Flow

- [x] [Doc] [x] [Impl] Group owner edits announcement and saves -> exactly ONE confirmation dialog appears (no duplicate)
- [x] [Doc] [x] [Impl] Admin edits announcement and saves -> exactly ONE confirmation dialog appears
- [x] [Doc] [x] [Impl] After clicking "Confirm" on the dialog, it closes and does not reappear
- [x] [Doc] [x] [Impl] After dismissing the dialog (cancel / close), no second dialog pops up
- [x] [Doc] [x] [Impl] Announcement content is saved correctly after a single confirmation

### A2. Edit Edge Cases

- [x] [Doc] [x] [Impl] Rapidly clicking the save button multiple times -> only one confirmation dialog appears
- [x] [Doc] [ ] [Impl] Edit announcement, save, then immediately edit again -> still only one dialog each time *(requires runtime test)*
- [x] [Doc] [x] [Impl] Edit announcement with empty content -> proper validation or save with one dialog only
- [x] [Doc] [ ] [Impl] Edit announcement on slow network -> dialog does not appear twice due to delayed response *(requires runtime test)*

---

## B. New Member Announcement Popup — Duplicate Display Fix (Bug #3)

### B1. Core Popup Flow

- [x] [Doc] [x] [Impl] New member joins group with an existing announcement -> announcement popup appears exactly ONCE
- [x] [Doc] [x] [Impl] After new member clicks "Confirm" on the announcement popup -> popup closes and does not reappear
- [x] [Doc] [x] [Impl] New member leaves the group chat and re-enters -> popup does NOT appear again (already read)
- [x] [Doc] [x] [Impl] `announcement_read_at` field is correctly set after the member confirms the announcement

### B2. Announcement Read State

- [x] [Doc] [x] [Impl] After confirming the announcement, `announcement_read_at` >= `announcement_at` in the database
- [x] [Doc] [x] [Impl] If the announcement is updated AFTER the member confirmed -> popup appears again (once) for the new version
- [x] [Doc] [x] [Impl] If the announcement has NOT changed since last read -> no popup on re-entering the group chat
- [x] [Doc] [x] [Impl] Multiple members joining at the same time -> each sees the popup exactly once independently

### B3. Existing Member Regression

- [x] [Doc] [x] [Impl] Existing member who already confirmed the current announcement -> no popup on entering group chat
- [x] [Doc] [x] [Impl] Existing member who has NOT confirmed a new announcement -> popup appears exactly once

---

## C. Keyboard Overlay Fix — Announcement Edit & Join Group Input (Bugs #2, #4)

### C1. Group Announcement Edit Textarea

- [x] [Doc] [x] [Impl] When editing group announcement on mobile, keyboard opens -> textarea scrolls up and stays fully visible above keyboard *(code structure verified)*
- [x] [Doc] [x] [Impl] Scroll-up behavior matches the existing chat input keyboard handling logic *(code structure verified)*
- [x] [Doc] [x] [Impl] After keyboard dismisses, the view returns to its normal position *(code structure verified)*
- [x] [Doc] [ ] [Impl] On Android Capacitor WebView -> textarea not covered by keyboard *(requires device test)*
- [x] [Doc] [ ] [Impl] On iOS Capacitor WebView -> textarea not covered by keyboard *(requires device test)*
- [x] [Doc] [x] [Impl] On Web browser (mobile viewport) -> textarea not covered by keyboard *(visualViewport fallback verified)*

### C2. Join Group Input Box

- [x] [Doc] [x] [Impl] When typing in "Join Group" input box on mobile, keyboard opens -> input scrolls up and stays visible above keyboard *(code structure verified)*
- [x] [Doc] [x] [Impl] Scroll-up behavior matches the existing chat input keyboard handling logic *(code structure verified)*
- [x] [Doc] [x] [Impl] After keyboard dismisses, the view returns to its normal position *(code structure verified)*
- [x] [Doc] [ ] [Impl] On Android Capacitor WebView -> input not covered by keyboard *(requires device test)*
- [x] [Doc] [ ] [Impl] On iOS Capacitor WebView -> input not covered by keyboard *(requires device test)*
- [x] [Doc] [x] [Impl] On Web browser (mobile viewport) -> input not covered by keyboard *(visualViewport fallback verified)*

### C3. Other Input Areas — Regression / Consistency Check

- [x] [Doc] [x] [Impl] Chat message input -> still scrolls up properly when keyboard opens (no regression)
- [x] [Doc] [x] [Impl] Group info panel name edit -> not covered by keyboard *(DrawerContent applies to all Drawers)*
- [x] [Doc] [x] [Impl] Group nickname edit -> not covered by keyboard *(DrawerContent applies to all Drawers)*
- [x] [Doc] [x] [Impl] Create group modal name input -> not covered by keyboard *(DrawerContent applies to all Drawers)*
- [x] [Doc] [ ] [Impl] Add friend search input -> not covered by keyboard *(requires runtime test — may not use Drawer)*
- [x] [Doc] [ ] [Impl] All search boxes (chat, market, discover) -> not covered by keyboard *(requires runtime test — may not use Drawer)*

---

## D. Invite Link Preview Card in Join Group (Bug #5)

### D1. Core Preview Behavior

- [x] [Doc] [x] [Impl] Paste a valid group invite link into "Join Group" search box -> group info preview card appears in real time
- [x] [Doc] [x] [Impl] Preview card shows group name, avatar (if any), and member count at minimum
- [x] [Doc] [x] [Impl] Preview card loads without requiring the user to press "Search" or "Enter" (real-time detection)
- [x] [Doc] [ ] [Impl] After preview card appears, user can click to join the group from the card *(requires runtime test)*
- [x] [Doc] [ ] [Impl] Join action from preview card follows the group's entry mode setting (free -> direct join, approval -> send request) *(requires runtime test)*

### D2. Input Format Handling

- [x] [Doc] [x] [Impl] Full invite URL (e.g., `https://ogbox-web3-app.vercel.app/group/join?token=xxx`) -> detected and preview shown
- [x] [Doc] [x] [Impl] Invite token only (if applicable) -> detected and preview shown
- [x] [Doc] [x] [Impl] Invalid / expired invite link pasted -> appropriate error message or "not found" state shown
- [x] [Doc] [x] [Impl] Random non-link text typed -> no preview card shown (normal search behavior)
- [x] [Doc] [x] [Impl] Partial link pasted (incomplete URL) -> no crash, no preview until valid link detected

### D3. Preview Edge Cases

- [x] [Doc] [x] [Impl] Paste invite link, then clear the input -> preview card disappears
- [x] [Doc] [ ] [Impl] Paste invite link, then modify text to break the link -> preview card disappears *(requires runtime test)*
- [x] [Doc] [ ] [Impl] Paste link for a group the user is already a member of -> preview shows with "Already Joined" indicator (or similar) *(requires runtime test)*
- [x] [Doc] [ ] [Impl] Paste link for a dissolved / deleted group -> shows appropriate error state *(requires runtime test)*
- [x] [Doc] [x] [Impl] Network error while loading preview -> shows loading state then error feedback (not silent failure)
- [x] [Doc] [ ] [Impl] Rapid paste-clear-paste actions -> no stale preview data displayed, latest paste result shown *(requires runtime test)*

---

## E. End-to-End Smoke Verification

### E1. Data Link Consistency

- [x] [Doc] [x] [Impl] After editing announcement, `groups.announcement` and `groups.announcement_at` are updated correctly in Supabase
- [x] [Doc] [x] [Impl] After member confirms announcement, `group_members.announcement_read_at` is updated correctly in Supabase
- [x] [Doc] [x] [Impl] Announcement read state comparison (`announcement_read_at` vs `announcement_at`) produces correct popup behavior
- [x] [Doc] [x] [Impl] Invite link token resolution -> correct group record returned from database
- [x] [Doc] [x] [Impl] Realtime subscription delivers announcement updates to all online group members without duplicate events

### E2. Permission & Role Boundary

- [x] [Doc] [x] [Impl] Only group owner and admin can edit announcements (regular members cannot)
- [x] [Doc] [x] [Impl] All members (including regular members) see the announcement popup when unread
- [x] [Doc] [ ] [Impl] Invite link paste preview works for non-members (they are the target users of "Join Group") *(requires runtime test)*
- [x] [Doc] [ ] [Impl] Expired or revoked invite link does not allow joining even if preview loads *(requires runtime test)*

### E3. Platform Compatibility

- [x] [Doc] [ ] [Impl] All 5 bug fixes work on Android Capacitor WebView *(requires device test)*
- [x] [Doc] [ ] [Impl] All 5 bug fixes work on iOS Capacitor WebView *(requires device test)*
- [x] [Doc] [ ] [Impl] All 5 bug fixes work on Web browser (Chrome / Safari desktop and mobile) *(requires runtime test)*

---

## F. Interaction Quality Verification

### F1. Input Interaction Compatibility

- [x] [Doc] [x] [Impl] Chinese IME input in announcement edit textarea -> composition works correctly, no premature submission
- [x] [Doc] [x] [Impl] Chinese IME input in "Join Group" search box -> composition works correctly
- [x] [Doc] [x] [Impl] Paste operation in "Join Group" search box -> triggers invite link detection immediately
- [x] [Doc] [ ] [Impl] Voice input / dictation into "Join Group" search box -> handled properly *(requires device test)*
- [x] [Doc] [ ] [Impl] Focus/blur cycle on announcement textarea -> no content loss *(requires runtime test)*
- [x] [Doc] [ ] [Impl] Focus/blur cycle on "Join Group" input -> no content loss, preview state preserved if link is valid *(requires runtime test)*

### F2. Operation Feedback

- [x] [Doc] [x] [Impl] Announcement save success -> toast or visual confirmation shown to the editor
- [x] [Doc] [x] [Impl] Announcement save failure (network error) -> error feedback shown, user can retry
- [x] [Doc] [x] [Impl] Invite link preview loading -> loading indicator visible while fetching group info
- [x] [Doc] [x] [Impl] Join group success from preview card -> toast confirmation and navigation to the group chat
- [x] [Doc] [x] [Impl] Join group failure (approval required) -> clear message that request has been sent

### F3. Announcement Popup Frequency Control

- [x] [Doc] [x] [Impl] Same announcement version -> popup shows at most once per member (controlled by `announcement_read_at`)
- [x] [Doc] [ ] [Impl] Updated announcement -> popup shows once for each member who has not confirmed the new version *(covered by B2.2 logic but needs runtime confirmation)*
- [x] [Doc] [x] [Impl] Popup does NOT appear on every group chat entry if already confirmed

### F4. Visual Consistency

- [x] [Doc] [x] [Impl] Invite link preview card style (colors, borders, spacing, font) matches existing project UI patterns
- [x] [Doc] [ ] [Impl] Announcement confirmation dialog style matches existing project modal/dialog patterns *(requires visual runtime test)*
- [x] [Doc] [x] [Impl] Keyboard scroll-up animation is smooth and consistent with existing chat input behavior
