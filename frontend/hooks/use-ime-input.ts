import { useCallback, useRef, useState } from 'react'

/**
 * Enhanced IME input hook that solves:
 * 1. Enter key triggering actions during CJK composition (e.g. saving group name while picking candidate)
 * 2. Search/filter flickering during composition (deferred value only updates after composition ends)
 * 3. Android Chrome compositionEnd event ordering race condition
 *    (Android: onChange → compositionEnd; Desktop: compositionEnd → onChange)
 *    Solved via compositionEndCount forcing effect re-triggers even when value is unchanged
 *
 * @deprecated useIMEComposition — use this hook instead for new code
 */
export function useIMEInput(initialValue = '') {
  const isComposingRef = useRef(false)
  const [value, setValue] = useState(initialValue)
  const [deferredValue, setDeferredValue] = useState(initialValue)
  const [compositionEndCount, setCompositionEndCount] = useState(0)

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const onCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    isComposingRef.current = false
    // Read the final value from the DOM element to handle Android Chrome event ordering
    const finalValue = e.currentTarget.value
    setValue(finalValue)
    setDeferredValue(finalValue)
    // Force increment to trigger downstream effects even if value is the same
    setCompositionEndCount(c => c + 1)
  }, [])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    // Only update deferred value when NOT composing (for non-CJK input, this is always true)
    if (!isComposingRef.current) {
      setDeferredValue(newValue)
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
    onCompositionStart,
    onCompositionEnd,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let newValue = e.target.value
      // Apply maxLength only when not composing
      if (options?.maxLength && !isComposingRef.current && newValue.length > options.maxLength) {
        newValue = newValue.slice(0, options.maxLength)
      }
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
  }), [onCompositionStart, onCompositionEnd])

  return {
    value,
    setValue,
    deferredValue,
    compositionEndCount,
    isComposingRef,
    getInputProps,
    onCompositionStart,
    onCompositionEnd,
    handleChange,
  }
}
