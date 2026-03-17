# Task90 — IME Chinese Input Debug Document

## Problem Summary

Chinese (CJK) input via IME does not trigger actions in multiple input fields across the app on Android/Capacitor. The web version works normally.

Affected areas:
1. **Add Friend** — Chinese nickname search not triggered
2. Chat input — mic icon doesn't switch to send icon after Chinese input
3. Join group — paste invite link doesn't trigger search
4. Nickname/group name — Chinese text disappears on save
5. Group announcement — Chinese text reverts
6. Group member search — Chinese input not detected

## Root Cause Analysis

### Architecture: `useIMEInput` hook

The project uses a custom `useIMEInput` hook (`frontend/hooks/use-ime-input.ts`) that implements a **deferred value pattern**:

- `value` — updates on every `onChange` (including during IME composition)
- `deferredValue` — only updates when `isComposingRef.current === false`
- `compositionEndCount` — counter incremented in `onCompositionEnd` to force effect re-triggers

### Why it fails on Android/Capacitor

1. **Event ordering**: Android Chrome fires `onChange` BEFORE `compositionEnd` (reversed from desktop). The hook handles this via `requestAnimationFrame` in `onCompositionEnd`.

2. **Critical bug**: Some Chinese IMEs on Android WebView **do not fire `compositionEnd`** when the user selects a candidate by tapping. This means:
   - `isComposingRef.current` stays `true` forever
   - `deferredValue` never updates
   - `compositionEndCount` never increments
   - Effects depending on these values never re-trigger

3. **Redundant guard**: Inside debounce callbacks, there's often an additional `if (isComposingRef.current) return` check, which creates a double-gate problem.

### Why web works

Desktop browsers correctly fire `compositionEnd` when a candidate is selected, so the deferred value pattern works as designed.

## Fix Strategy

**For search-type inputs**: Don't use `deferredValue`. Use the live `value` directly with a longer debounce (500ms). Search doesn't need the deferred pattern — the debounce alone prevents unnecessary API calls during IME input.

**For save/submit inputs**: Keep the deferred pattern but add a fallback timeout (if `compositionEnd` doesn't fire within N ms after the last `onChange`, force-sync).

## Fix #1: Add Friend Chinese Search (this task)

### File: `frontend/components/chat/AddFriendModal.tsx`

**Before** (lines 98-179):
- Search effect depends on `deferredSearchInput` and `compositionEndCount`
- Line 151: `if (isComposingRef.current) return` inside debounce callback
- 300ms debounce

**After**:
- Search effect depends on `searchInput` (live value, updates during composition)
- Removed `isComposingRef.current` guard
- 500ms debounce (to compensate for IME intermediate values like pinyin "zhong")
- Removed `compositionEndCount` dependency

**Why this works**:
- Every keystroke/candidate selection fires `onChange`, updating `searchInput`
- Debounce resets on each change, so intermediate pinyin values don't trigger search
- After user stops typing for 500ms, search runs regardless of composition state
- Address search is unaffected because `ADDRESS_REGEX` only matches complete 42-char addresses

## Test Plan

- [ ] Type Chinese nickname in Add Friend search → search should trigger
- [ ] Type English text → search should still work
- [ ] Paste wallet address → search should still work
- [ ] Type pinyin but don't select candidate → should not trigger premature search
- [ ] Test on Android Capacitor app
- [ ] Test on web browser (regression check)

## Change Log

| Date | Change | Result |
|------|--------|--------|
| 2026-03-17 | Fix #1: Switch AddFriendModal search from deferredValue to live value with 500ms debounce | Pending test |
