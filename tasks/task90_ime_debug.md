# Task90 — IME Chinese Input Debug Document

## Problem Summary

Chinese (CJK) input via IME does not trigger actions in multiple input fields across the app on Android/Capacitor. The web version works normally.

**Key symptom**: Any text entered by tapping an IME candidate (Chinese characters, emoji, etc.) is NOT detected by React. Only direct keyboard input (ASCII characters, numbers) triggers React state updates.

Affected areas:
1. **Add Friend** — Chinese nickname search not triggered
2. Chat input — mic icon doesn't switch to send icon after Chinese input
3. Join group — paste invite link doesn't trigger search
4. Nickname/group name — Chinese text disappears on save
5. Group announcement — Chinese text reverts
6. Group member search — Chinese input not detected

## Root Cause Analysis (Updated after Fix #1 test)

### Level 1 (Initial hypothesis — WRONG)

Initially believed `useIMEInput` hook's deferred value pattern was the problem (compositionEnd not firing → deferredValue stuck). Fix #1 switched to live `searchInput` value.

**Test result**: FAILED. The paste icon still didn't change, meaning `searchInput` (React state) was never updated at all.

### Level 2 (True root cause — CONFIRMED)

**React's synthetic `onChange` event does NOT fire when the user taps an IME candidate on this Android WebView (Capacitor).**

On Android WebView, when a user selects a Chinese character from the IME candidate bar:
1. The IME inserts text into the DOM input element directly
2. The browser fires a native DOM `input` event
3. BUT React's synthetic `onChange` event is **NOT** triggered
4. Therefore React state (`setValue()`) is never called
5. The controlled input's `value` prop stays at the old value

This is a known React issue with Android WebView IME integration. It affects ALL React controlled inputs on this platform, not just our `useIMEInput` hook.

**Evidence**:
- Paste icon visibility depends on `!searchInput` (React state)
- After Chinese input via IME, paste icon remains visible → React state is empty string
- Direct character input (no IME) → paste icon hides → React state updates correctly

### Why web works

Desktop browsers fire React's synthetic onChange correctly for both direct input and IME candidate selection.

## Fix Strategy (Updated)

**The solution is to bypass React's synthetic event system entirely on inputs that need IME support.**

Use **uncontrolled inputs** (no `value` prop) with:
1. A `ref` to the DOM element
2. A native DOM `input` event listener (fires reliably for ALL input methods)
3. React state updated from the native event (for triggering effects/re-renders)
4. Programmatic value setting via `ref.current.value = ...` when needed

This pattern should be applied to all affected inputs across the app.

## Fix #1: Switch from deferredValue to live value (OTA 1.0.20)

**Approach**: Changed search effect dependency from `deferredSearchInput` to `searchInput` (live value from useIMEInput hook).

**Result**: FAILED. React's `onChange` itself doesn't fire for IME candidates, so `searchInput` never updates either. The hook is irrelevant — the problem is at React's event layer.

## Fix #2: Uncontrolled input with native DOM event (OTA 1.0.21)

### File: `frontend/components/chat/AddFriendModal.tsx`

**Changes**:
1. Removed `useIMEInput` hook entirely
2. Added `searchInputRef` (ref to DOM element) + `searchText` (React state)
3. Attached native `input` event listener via `addEventListener('input', handler)`
4. Input element is now **uncontrolled** — no `value` prop, DOM manages its own value
5. `setSearchInput()` helper sets both DOM value and React state for programmatic updates
6. All UI references use `searchText` (state from native event)

**Why this should work**:
- Native DOM `input` event fires for ALL input methods: keyboard, IME candidate tap, paste, autofill
- React's synthetic event system is completely bypassed
- The uncontrolled input never fights with React over the input value
- 500ms debounce still prevents searching on intermediate pinyin keystrokes

## Test Plan

- [ ] Type Chinese nickname in Add Friend search → search should trigger
- [ ] Type English text → search should still work
- [ ] Paste wallet address → search should still work
- [ ] Paste icon should hide when text is in the input
- [ ] Test on Android Capacitor app
- [ ] Test on web browser (regression check)

## Change Log

| Date | Change | Result |
|------|--------|--------|
| 2026-03-17 | Fix #1: Switch from deferredValue to live searchInput with 500ms debounce (OTA 1.0.20) | FAILED — React onChange doesn't fire at all for IME candidates |
| 2026-03-17 | Fix #2: Uncontrolled input + native DOM input event listener via useEffect (OTA 1.0.21) | FAILED — useEffect([]) runs on mount when input is not rendered yet (inside `{isOpen && ...}`), so ref is null and no listener is attached. Even worse: removed React onChange so regular characters also stopped working |
| 2026-03-17 | Fix #3: Callback ref instead of useEffect for event listener attachment (OTA 1.0.22) | Pending test |

## Fix #3: Callback ref for event listener (OTA 1.0.22)

**Bug in Fix #2**: The `useEffect(() => { ... }, [])` runs once on component mount. But the `<input>` element is inside `{isOpen && (...)}` — it doesn't exist in the DOM when the effect runs. So `searchInputRef.current` is `null` and no event listener is attached.

**Fix**: Use a **callback ref** (`ref={callbackFn}`) instead of `useRef` + `useEffect`. React calls the callback ref with the DOM element exactly when it enters/leaves the DOM. This guarantees the native `input` event listener is attached at the right time.
