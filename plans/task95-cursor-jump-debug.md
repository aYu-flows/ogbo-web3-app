# Task95 — Cursor Jumping to End in Text Inputs (Debug Log)

## Problem Description

When user taps in the middle of existing text in an input field, then types new characters, the new characters appear at the **end** of the text instead of at the cursor position. Confirmed on Android WebView (Capacitor app).

## Environment

- Android WebView via Capacitor
- React 19 + Next.js 16
- Controlled inputs use `useIMEInput` hook (with 300ms polling for IME)
- Chat message input is **uncontrolled** (no `value` prop, uses `ref` only)

---

## Affected Inputs (to be confirmed by user)

| Input | Type | Component | File |
|-------|------|-----------|------|
| Chat message | Uncontrolled | `<input ref={...}>` | ChatPage.tsx:935 |
| Group name edit | Controlled | `value={nameIME.value}` | GroupInfoPanel.tsx:413 |
| Group nickname edit | Controlled | `value={nicknameIME.value}` | GroupInfoPanel.tsx:507 |
| Group announcement | Controlled | `value={editText}` | GroupAnnouncementModal.tsx:126 |
| Profile nickname | Controlled | `getInputProps()` | ProfileEditModal.tsx:180 |
| Search (chat) | Controlled | `value={searchQuery}` | ChatPage.tsx:1229 |
| Search (market) | Controlled | `value={searchQuery}` | MarketPage.tsx:190 |
| Search (discover) | Controlled | `value={searchQuery}` | DiscoverPage.tsx:153 |
| Create group name | Controlled | `value={groupName}` | CreateGroupModal.tsx:109 |

---

## Debug Rounds

### Round 1 — useLayoutEffect cursor restore (OTA 1.0.29) — FAILED

**Hypothesis**: `useIMEInput` hook's `setValue()` calls trigger React re-renders that reset cursor on Android WebView controlled inputs.

**Fix applied**:
- Added `cursorRef` to save `selectionStart`/`selectionEnd` before every `setValue()`
- Added `useLayoutEffect` dependent on `[value]` to restore cursor via `setSelectionRange()`
- Applied to: `handleChange`, `getInputProps` onChange, polling callback, `onCompositionEnd`

**Result**: FAILED — cursor still jumps to end. OTA 1.0.29 confirmed deployed (badge 1.29).

**Analysis of failure**:
- Possible reasons:
  1. The main issue is on the **chat message input** which is UNCONTROLLED — `useIMEInput` fix has no effect there
  2. `useLayoutEffect` may not fire at the right time on Android WebView (rAF might be needed instead)
  3. The cursor save happens AFTER the browser has already moved cursor to end (too late)
  4. Something else is causing cursor reset (e.g., parent re-render unmounting/remounting input)

**Questions for user**:
- Which specific input(s) have this problem? (chat message box? group name? profile nickname? all of them?)
- Does the cursor visually move to the correct position when you tap, then jump to end when you start typing?
- Or does the cursor never move to the tapped position at all?

---

### Round 2 — cursor save/restore in setupInputPolling + defer compositionEnd re-renders (OTA 1.0.30)

**User feedback from Round 1**:
- Affected: chat message input (uncontrolled), add friend search input (uncontrolled), likely all inputs
- Normal character input works fine — cursor stays at tapped position
- ONLY Chinese IME candidate word selection causes cursor to jump to end
- Related to previous Task92 IME issue (candidate taps fire no events → polling was added)

**Why Round 1 failed**: Round 1 only fixed controlled inputs via `useIMEInput`. The main affected inputs (chat, add friend search) are UNCONTROLLED — they don't use `value` prop, so `useLayoutEffect` cursor restore has no effect.

**Hypothesis**: `setupInputPolling`'s `sync` callback triggers React state updates (`setHasText`, `setSearchText`) during the native `input` event fired by IME candidate selection. Even for uncontrolled inputs, the synchronous React re-render during IME event processing interferes with Android WebView's cursor management. Additionally, `onCompositionEnd` handlers call `setIsComposing(false)` synchronously, triggering another re-render during the composition finalization.

**Fix applied**:
1. `setupInputPolling` — save cursor position before `onSync`, restore via `requestAnimationFrame` after React re-render
2. ChatPage chat input `onCompositionEnd` — defer `setIsComposing(false)` to rAF, save/restore cursor
3. Keep Round 1 `useLayoutEffect` fix for controlled inputs (no harm)

**Result**: FAILED — cursor still jumps to end on IME candidate selection (OTA 1.0.31 confirmed).

---

### Round 4 — Skip ALL synchronous React updates during IME composition (OTA 1.0.32)

**Why Rounds 1-3 all failed**:
- Round 1: useLayoutEffect cursor restore → cursor already wrong when saved
- Round 2: rAF cursor restore → WebView overrides after rAF
- Round 3: Calculate cursor position + setTimeout(50ms) → still overridden

All three tried to FIX cursor position after the fact. None worked. New theory: the problem is not cursor position being reset — it's that synchronous React state updates during the native `input` event of IME composition interfere with Android WebView's IME cursor management at a fundamental level.

**Hypothesis**: `setupInputPolling`'s native `input` event listener calls `onSync()` synchronously during IME composition events. This triggers React state updates (`setHasText`, `setSearchText`) and DOM reconciliation DURING the IME's text replacement process. Android WebView's IME is sensitive to DOM changes during composition, causing it to lose track of cursor position.

**Fix applied**:
1. `setupInputPolling` now tracks composition state via native `compositionstart`/`compositionend` listeners
2. Native `input` event handler SKIPS sync when `isComposing` is true
3. Polling (300ms interval) still runs and handles value detection during composition
4. `compositionend` triggers a deferred sync after 60ms (not synchronous)
5. Chat input `onInput`/`onChange` also guarded by `isComposing` — no `handleInput()` during composition
6. Chat input `onCompositionEnd` defers `setIsComposing(false)` + `handleInput()` to `setTimeout(60ms)`
7. `useIMEInput` `onCompositionEnd` defers `setValue` to `setTimeout(60ms)`

**Key difference from previous rounds**: Instead of trying to fix cursor AFTER it jumps, this round prevents the interference that CAUSES the jump by ensuring zero synchronous React state updates during IME composition.

**Result**: PARTIALLY FAILED — Round 4 used `useState` (`isComposing`) for the guard, but React batches state updates. When `compositionstart` fires and calls `setIsComposing(true)`, the `isComposing` value in `onInput`'s closure is still `false` when the `input` event fires immediately after. The guard was ineffective.

---

### Round 5 — useRef for synchronous IME guard (OTA 1.0.33)

**Why Round 4 failed**: The `isComposing` guard used React `useState`, which batches updates. Event sequence on Android WebView:
1. `compositionstart` → `setIsComposing(true)` (batched, NOT immediate)
2. `input` event → `onInput` checks `isComposing` → still `false` → `handleInput()` runs → `setHasText()` → React re-render during IME → cursor jumps
3. `compositionend` → deferred OK, but damage already done at step 2

**Hypothesis**: The `input` event fires synchronously after `compositionstart` on Android WebView. React's `useState` setter is batched, so the guard value is stale. Need `useRef` which updates synchronously and is immediately visible to all handlers.

**Fix applied (ChatPage.tsx chat input ONLY)**:
1. Added `isComposingRef = useRef(false)` — synchronous composition tracking
2. `onCompositionStart`: sets `isComposingRef.current = true` (immediate) + `setIsComposing(true)` (for Enter key guard)
3. `handleInput()`: checks `isComposingRef.current` — returns early if composing (ZERO React state updates during IME)
4. `onInput={handleInput}` / `onChange={handleInput}` — guard is inside handleInput, no closure stale value issue
5. `onCompositionEnd`: defers everything to `setTimeout(60ms)` — `isComposingRef.current = false`, `setIsComposing(false)`, `handleInput()`
6. Polling still disabled (diagnostic from Round 5)

**Key difference from Round 4**: `useRef` updates are synchronous and immediately visible to all event handlers. No React batching delay. The `input` event handler sees `isComposingRef.current === true` immediately after `compositionstart` sets it.

**Result**: TBD (waiting for user test) — Calculate cursor position instead of save/restore (OTA 1.0.31)

**Why Round 2 failed**: Android WebView moves cursor to end BEFORE any JS event handler runs. So `el.selectionStart` is already wrong at save time. rAF restore also fails because WebView may override cursor after rAF.

**New approach**: Don't try to save/restore cursor. Instead, CALCULATE the correct position:
1. On `compositionstart`: save `el.selectionStart` as `compStartPos` and `el.value` as `valueBeforeComp`
2. On `compositionend` (if it fires): correct position = `compStartPos + e.data.length`
3. On polling sync (if compositionend didn't fire): correct position = `compStartPos + candidateLen` where `candidateLen = newValue.length - compStartPos - suffixLen` and `suffixLen = valueBeforeComp.length - compStartPos`
4. Use `setTimeout(50ms)` instead of rAF — WebView may override cursor after rAF

**Fix applied**:
- `setupInputPolling` now listens for `compositionstart`/`compositionend` events directly
- Tracks `compStartPos` and `valueBeforeComp` for cursor calculation
- Both `compositionend` handler and polling `sync` calculate and restore cursor
- Chat input `onCompositionStart` saves `compStartPosRef`, `onCompositionEnd` calculates correct position
- `useIMEInput` hook `onCompositionStart` saves `compStartPosRef`, `onCompositionEnd` uses `e.data.length`

**Result**: FAILED — cursor still jumps to end on IME candidate selection (OTA 1.0.31 confirmed).

---

### Round 4 — Skip ALL synchronous React updates during IME composition (OTA 1.0.32)

**Why Rounds 1-3 all failed**:
- Round 1: useLayoutEffect cursor restore → cursor already wrong when saved
- Round 2: rAF cursor restore → WebView overrides after rAF
- Round 3: Calculate cursor position + setTimeout(50ms) → still overridden

All three tried to FIX cursor position after the fact. None worked. New theory: the problem is not cursor position being reset — it's that synchronous React state updates during the native `input` event of IME composition interfere with Android WebView's IME cursor management at a fundamental level.

**Hypothesis**: `setupInputPolling`'s native `input` event listener calls `onSync()` synchronously during IME composition events. This triggers React state updates (`setHasText`, `setSearchText`) and DOM reconciliation DURING the IME's text replacement process. Android WebView's IME is sensitive to DOM changes during composition, causing it to lose track of cursor position.

**Fix applied**:
1. `setupInputPolling` now tracks composition state via native `compositionstart`/`compositionend` listeners
2. Native `input` event handler SKIPS sync when `isComposing` is true
3. Polling (300ms interval) still runs and handles value detection during composition
4. `compositionend` triggers a deferred sync after 60ms (not synchronous)
5. Chat input `onInput`/`onChange` also guarded by `isComposing` — no `handleInput()` during composition
6. Chat input `onCompositionEnd` defers `setIsComposing(false)` + `handleInput()` to `setTimeout(60ms)`
7. `useIMEInput` `onCompositionEnd` defers `setValue` to `setTimeout(60ms)`

**Key difference from previous rounds**: Instead of trying to fix cursor AFTER it jumps, this round prevents the interference that CAUSES the jump by ensuring zero synchronous React state updates during IME composition.

**Result**: TBD (waiting for user test)

---

## Key Code References

### Chat message input (UNCONTROLLED)
- `ChatPage.tsx:935` — `<input ref={messageInputCallbackRef} onInput={handleInput} ...>`
- No `value` prop — browser handles cursor natively
- `handleInput` (line 412) only calls `setHasText()` — does NOT modify input value
- Polling (line 428) only calls `setHasText()` — does NOT modify input value
- Emoji insert (line 924): `inputRef.current.value += emoji` — always appends to end (separate issue)

### useIMEInput hook (CONTROLLED inputs)
- `hooks/use-ime-input.ts`
- Manages `value` state via `useState` + `setValue`
- Polling via `setupInputPolling` calls `setValue(v)` every 300ms on change
- `onCompositionEnd` uses `requestAnimationFrame` → `setValue`
- Round 1 fix: `cursorRef` + `useLayoutEffect` restore — did not work
