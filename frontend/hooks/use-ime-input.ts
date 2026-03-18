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
  const sync = () => {
    const v = el.value
    if (v !== lastSynced) {
      // Save cursor position BEFORE onSync triggers React re-renders
      const start = el.selectionStart
      const end = el.selectionEnd
      lastSynced = v
      onSync(v)
      // Restore cursor after React re-render to prevent IME candidate selection
      // from jumping cursor to end on Android WebView
      requestAnimationFrame(() => {
        if (document.activeElement === el && start !== null) {
          try { el.setSelectionRange(start, end ?? start) } catch (_) {}
        }
      })
    }
  }
  // Primary: native input event (instant for regular keyboard)
  el.addEventListener('input', sync)
  // Fallback: polling to catch IME candidate taps that fire no events
  const pollId = setInterval(sync, interval)
  return () => {
    el.removeEventListener('input', sync)
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

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const onCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // MUST be synchronous — on Android, onChange fires before compositionEnd.
    // If deferred, handleChange would still see isComposing=true and skip deferredValue update.
    isComposingRef.current = false
    const el = e.currentTarget
    // Save cursor BEFORE any async work — this is the correct position right after IME finalization
    const start = el.selectionStart
    const end = el.selectionEnd
    // Use rAF to ensure DOM value is finalized (Android WebView timing issue).
    requestAnimationFrame(() => {
      const finalValue = el.value
      cursorRef.current = { start, end }
      setValue(finalValue)
      setDeferredValue(finalValue)
      setCompositionEndCount(c => c + 1)
      // Double rAF: restore cursor after React re-render completes
      requestAnimationFrame(() => {
        if (document.activeElement === el && start !== null) {
          try { el.setSelectionRange(start, end ?? start) } catch (_) {}
        }
      })
    })
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
