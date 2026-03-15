# Task85: Fix Dissolve Group Blank Page + Chinese IME Input Detection

## 1. Task Description

Two bugs to fix:

**Bug A**: After group owner dissolves a group, the chat list page shows blank. The dissolved group may persist after app restart if the user force-kills the app during the blank page.

**Bug B**: After typing Chinese text via IME in almost all input fields (chat input, search, nickname, etc.), the system does not detect the input. For example, the chat input's microphone icon does not change to the send icon. The user must type one additional character for the system to detect the Chinese text. This is a long-standing issue that previous fixes (Task78/79/80/84) did not fully resolve.

---

## 2. Implementation Checklist

### Phase 1: Bug A — Dissolve Group Blank Page (AI)

- [x] **1.1** Add auto-deselect `useEffect` in `ChatPage` parent component (`frontend/components/pages/ChatPage.tsx`)
  - When `selectedChat` is set but chat no longer exists in `chats`, reset `selectedChat` to `null` and call `setActiveChatId(null)`
  - Place after existing wallet-switch useEffect (around line 1061)
- [x] **1.2** Run `git diff` to verify changes
- [x] **1.3** Run `npx tsc --noEmit` to verify no type errors

### Phase 2: Bug B — IME Input Detection (AI, can run in parallel with Phase 1)

- [x] **2.1** Update `useIMEInput` hook (`frontend/hooks/use-ime-input.ts`)
  - In `onCompositionEnd`: keep `isComposingRef.current = false` synchronous, move value reading to `requestAnimationFrame`
  - In `getInputProps` wrapper: same rAF pattern for the compositionEnd handler
- [x] **2.2** Update chat input in `ChatDetail` (`frontend/components/pages/ChatPage.tsx`)
  - Add native DOM `input` event listener via `useEffect` on `inputRef.current`
  - Update `onCompositionEnd` handler to use `requestAnimationFrame` instead of `setTimeout(fn, 0)`
- [x] **2.3** Run `git diff` to verify changes
- [x] **2.4** Run `npx tsc --noEmit` to verify no type errors

### Phase 3: Verification (AI)

- [x] **3.1** Run `git diff --stat` to verify total changes match expected files
- [x] **3.2** Run full TypeScript type check
- [x] **3.3** Verify testchecklist [Impl] items via code path tracing

---

## 3. Bug A: Dissolve Group Blank Page

### 3.1 Root Cause

In `ChatPage.tsx` (parent component, line 1038+):

```
const activeChat = chats.find((c) => c.id === selectedChat);   // line 1113
```

Chat list panel visibility (line 1124):
```
className="... ${selectedChat ? "hidden lg:flex" : "flex"}"
```

Mobile ChatDetail rendering (line 1419):
```
{activeChat && (<ChatDetail chat={activeChat} ... />)}
```

After dissolution:
1. `dissolveGroupAction` (store.ts:2002) removes the chat from `chats`
2. `activeChat` becomes `undefined` (chat no longer in `chats`)
3. ChatDetail is unmounted (because `activeChat` is falsy)
4. The dissolution alert (rendered INSIDE ChatDetail at line 1006) is also unmounted
5. `selectedChat` remains the dissolved group's ID (a truthy string)
6. Chat list panel is **hidden** on mobile (`selectedChat ? "hidden" : "flex"`)
7. **Result**: completely blank page — no ChatDetail, no chat list

### 3.2 Fix

Add a `useEffect` in the parent `ChatPage` component that detects when `selectedChat` references a non-existent chat, and auto-resets it:

**File**: `frontend/components/pages/ChatPage.tsx`

Add after the wallet-switch useEffect (around line 1061):

```typescript
// Auto-deselect when the selected chat no longer exists (e.g. dissolved/removed)
useEffect(() => {
  if (selectedChat && !chats.some(c => c.id === selectedChat)) {
    setSelectedChat(null);
    setActiveChatId(null);
  }
}, [chats, selectedChat]);
```

This also fixes the `leaveGroupAction` flow which has the same pattern.

### 3.3 Change Impact Analysis

- **`selectedChat`** — consumed by: chat list panel visibility, `activeChat` derivation, ChatDetail rendering. After fix, when chat is dissolved, `selectedChat` resets to null → chat list becomes visible, ChatDetail stops trying to render.
- **`setActiveChatId`** — from `soundPlayer.ts`, used to suppress notification sounds for active chat. Setting to null is correct after dissolution.
- **No other consumers** affected. The fix only adds auto-cleanup when state becomes inconsistent.

---

## 4. Bug B: Chinese IME Input Detection

### 4.1 Root Cause

Two input patterns in the project, both affected:

**Pattern 1 — Chat input (uncontrolled, `inputRef`):**
- `handleInput()` reads `inputRef.current?.value` and sets `hasText`
- `onCompositionEnd` uses `setTimeout(fn, 0)` to call `handleInput()`
- On Android Capacitor WebView, `setTimeout(fn, 0)` can run before the DOM value is finalized after composition. The native `input` event that carries the final value may not consistently trigger React's synthetic `onInput`/`onChange`.

**Pattern 2 — All other inputs (`useIMEInput` hook):**
- `deferredValue` only updates when `isComposingRef.current === false`
- `onCompositionEnd` reads `e.currentTarget.value` to set `deferredValue`
- On Android, `onChange` fires BEFORE `compositionEnd`. During `onChange`, `isComposingRef.current` is still `true`, so `deferredValue` is not updated. `onCompositionEnd` then reads `e.currentTarget.value`, but on some Android WebViews this value may not yet reflect the final composed character.

**Evidence**: "Must type one more character for detection" — confirms the NEXT input event correctly reads the full value (including Chinese text), proving the value IS in the DOM but post-composition handlers didn't pick it up.

### 4.2 Fix

#### 4.2.1 Chat Input (ChatPage.tsx ChatDetail)

Replace the current `onCompositionEnd` handler and add a native DOM event listener as a reliable fallback:

**File**: `frontend/components/pages/ChatPage.tsx`

1. Add a `useEffect` that attaches a native `input` event listener to the input DOM element. This bypasses React's synthetic event system entirely:

```typescript
// Native input listener — reliable on all platforms including Android WebView
useEffect(() => {
  const el = inputRef.current;
  if (!el) return;
  const handler = () => {
    setHasText(el.value.trim().length > 0);
  };
  el.addEventListener('input', handler);
  return () => el.removeEventListener('input', handler);
}, []);
```

2. Update the `onCompositionEnd` handler to use `requestAnimationFrame` instead of `setTimeout(fn, 0)`:

```typescript
onCompositionEnd={() => {
  requestAnimationFrame(() => {
    setIsComposing(false);
    handleInput();
  });
}}
```

#### 4.2.2 `useIMEInput` Hook (Global Fix)

**File**: `frontend/hooks/use-ime-input.ts`

Update the `onCompositionEnd` handler to use `requestAnimationFrame` for more reliable DOM value reading:

```typescript
const onCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
  // MUST be synchronous — on Android, onChange fires before compositionEnd.
  // If we defer this, handleChange would still see isComposing=true and skip deferredValue update.
  isComposingRef.current = false
  const el = e.currentTarget
  // Read value in rAF to ensure DOM is finalized (Android WebView timing issue).
  // If onChange already ran (Android order), this is a harmless redundant update.
  requestAnimationFrame(() => {
    const finalValue = el.value
    setValue(finalValue)
    setDeferredValue(finalValue)
    setCompositionEndCount(c => c + 1)
  })
}, [])
```

Also update the `getInputProps` wrapper's `onCompositionEnd` in the same way.

### 4.3 Change Impact Analysis

- **`useIMEInput` hook** — consumed by: ChatPage search, MarketPage search, DiscoverPage search, GroupMemberList search, GroupInfoPanel name/nickname, InviteFriendsToGroupModal search, GroupAnnouncementModal text, CreateGroupModal name/search, AddFriendModal search. All consumers benefit from the fix automatically.
- **`handleInput` in ChatDetail** — consumed only locally for `hasText` state. The native event listener is additive, does not interfere with existing React handlers.
- **`requestAnimationFrame` vs `setTimeout(0)`** — `rAF` runs after the browser has completed DOM updates and before paint. This is more reliable than `setTimeout(0)` which may run before DOM finalization on some platforms. No behavioral change for non-IME input.

---

## 5. Files to Modify

| File | Change |
|------|--------|
| `frontend/components/pages/ChatPage.tsx` | Add auto-deselect useEffect + native input listener + rAF in compositionEnd |
| `frontend/hooks/use-ime-input.ts` | Update onCompositionEnd to use rAF; update getInputProps wrapper |

---

## 6. Unit Tests

**Bug A (Dissolve blank page):**
- Not feasible as a unit test (requires React rendering + Zustand store interaction). Verified via code path tracing.

**Bug B (IME input):**
- The `useIMEInput` hook's `onCompositionEnd` should update `deferredValue` after rAF. Since rAF is browser-specific, the test would mock `requestAnimationFrame` and verify that `deferredValue` and `compositionEndCount` update after the callback fires.

