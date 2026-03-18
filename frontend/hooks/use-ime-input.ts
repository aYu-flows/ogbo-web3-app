import { useCallback, useLayoutEffect, useRef, useState } from 'react'

/**
 * Sets up polling + native input event on a DOM element to detect ALL input
 * methods, including Android WebView IME candidate taps that fire no events.
 *
 * Returns a cleanup function.
 */
export function setupInputPolling(
  el: HTMLInputElement | HTMLTextAreaElement,
  onSync: (value: string) => void,
  interval = 300,
): () => void {
  let lastSynced = el.value
  // Track composition state to SKIP synchronous onSync during IME operations.
  // On Android WebView, calling onSync (which triggers React state updates)
  // during the native input event of an IME candidate selection interferes
  // with the WebView's cursor management, causing cursor to jump to end.
  let isComposing = false

  const onCompStart = () => { isComposing = true }
  const onCompEnd = () => {
    isComposing = false
    // Deferred sync after composition ends — let WebView finalize cursor first
    setTimeout(() => {
      const v = el.value
      if (v !== lastSynced) {
        lastSynced = v
        onSync(v)
      }
    }, 60)
  }

  const sync = () => {
    const v = el.value
    if (v !== lastSynced) {
      lastSynced = v
      onSync(v)
    }
  }

  // Native input event: SKIP during composition to avoid interfering with IME cursor
  const onNativeInput = () => {
    if (!isComposing) sync()
  }

  el.addEventListener('compositionstart', onCompStart)
  el.addEventListener('compositionend', onCompEnd)
  el.addEventListener('input', onNativeInput)
  // Polling fallback: catches IME candidate taps that fire no events,
  // and also handles composition changes (since native input is skipped during composition)
  const pollId = setInterval(sync, interval)
  return () => {
    el.removeEventListener('compositionstart', onCompStart)
    el.removeEventListener('compositionend', onCompEnd)
    el.removeEventListener('input', onNativeInput)
    clearInterval(pollId)
  }
}

/**
 * Enhanced IME input hook that solves:
 * 1. Enter key triggering actions during CJK composition (e.g. saving group name while picking candidate)
 * 2. Search/filter flickering during composition (deferred value only updates after composition ends)
 * 3. Android Chrome compositionEnd event ordering race condition
 *    (Android: onChange → compositionEnd; Desktop: compositionEnd → onChange)
 *    Solved via compositionEndCount forcing effect re-triggers even when value is unchanged
 * 4. Android WebView IME candidate taps firing NO events at all — solved via 300ms polling fallback
 *
 * @deprecated useIMEComposition — use this hook instead for new code
 */
export function useIMEInput(initialValue = '') {
  const isComposingRef = useRef(false)
  const [value, setValue] = useState(initialValue)
  const [deferredValue, setDeferredValue] = useState(initialValue)
  const [compositionEndCount, setCompositionEndCount] = useState(0)
  const cleanupRef = useRef<(() => void) | null>(null)
  const elRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  // Cursor position tracking — saves before setValue, restores after React re-render
  const cursorRef = useRef<{ start: number | null; end: number | null }>({ start: null, end: null })

  // Restore cursor position after React re-renders the controlled input value
  useLayoutEffect(() => {
    const el = elRef.current
    const pos = cursorRef.current
    if (el && pos.start !== null && document.activeElement === el) {
      try { el.setSelectionRange(pos.start, pos.end ?? pos.start) } catch (_) { /* ignore on non-text inputs */ }
    }
    cursorRef.current = { start: null, end: null }
  }, [value])

  // Track composition start position for cursor calculation
  const compStartPosRef = useRef<number | null>(null)

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true
    const el = elRef.current
    if (el) compStartPosRef.current = el.selectionStart
  }, [])

  const onCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false
    const el = e.currentTarget
    compStartPosRef.current = null
    // Defer state updates to avoid interfering with IME cursor on Android WebView.
    // The setupInputPolling compositionend handler + polling will handle value sync.
    setTimeout(() => {
      const finalValue = el.value
      cursorRef.current = { start: el.selectionStart, end: el.selectionEnd }
      setValue(finalValue)
      setDeferredValue(finalValue)
      setCompositionEndCount(c => c + 1)
    }, 60)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    cursorRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd }
    setValue(newValue)
    // Only update deferred value when NOT composing (for non-CJK input, this is always true)
    if (!isComposingRef.current) {
      setDeferredValue(newValue)
    }
  }, [])

  /**
   * Callback ref that sets up polling when the element mounts.
   * Use this as the `ref` on your input/textarea to auto-detect IME input.
   * Can be spread via getInputProps() or used standalone.
   */
  const inputCallbackRef = useCallback((el: HTMLInputElement | HTMLTextAreaElement | null) => {
    // Cleanup previous
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
    elRef.current = el
    if (el) {
      cleanupRef.current = setupInputPolling(el, (v) => {
        cursorRef.current = { start: el.selectionStart, end: el.selectionEnd }
        setValue(v)
        // If composing stuck (no compositionEnd fired), reset it
        if (isComposingRef.current) {
          isComposingRef.current = false
        }
        setDeferredValue(v)
      })
    }
  }, [])

  /**
   * Returns input props that should be spread onto the input/textarea element.
   * @param options.onEnter - called when Enter is pressed outside of composition
   * @param options.onChange - called on every change (including during composition)
   * @param options.maxLength - if set, truncates value to maxLength only outside composition
   */
  const getInputProps = useCallback((options?: {
    onEnter?: () => void
    onChange?: (value: string) => void
    maxLength?: number
  }) => ({
    ref: inputCallbackRef,
    onCompositionStart,
    onCompositionEnd,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let newValue = e.target.value
      // Apply maxLength only when not composing
      if (options?.maxLength && !isComposingRef.current && newValue.length > options.maxLength) {
        newValue = newValue.slice(0, options.maxLength)
      }
      // Save cursor before React re-render; adjust if maxLength truncated
      const rawCursor = e.target.selectionStart
      const cursor = (options?.maxLength && rawCursor !== null && rawCursor > options.maxLength)
        ? options.maxLength : rawCursor
      cursorRef.current = { start: cursor, end: cursor }
      setValue(newValue)
      if (!isComposingRef.current) {
        // Truncate for deferred as well
        if (options?.maxLength && newValue.length > options.maxLength) {
          newValue = newValue.slice(0, options.maxLength)
        }
        setDeferredValue(newValue)
      }
      options?.onChange?.(newValue)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && !isComposingRef.current) {
        options?.onEnter?.()
      }
    },
  }), [inputCallbackRef, onCompositionStart, onCompositionEnd])

  return {
    value,
    setValue,
    deferredValue,
    compositionEndCount,
    isComposingRef,
    getInputProps,
    inputCallbackRef,
    elRef,
    onCompositionStart,
    onCompositionEnd,
    handleChange,
  }
}
