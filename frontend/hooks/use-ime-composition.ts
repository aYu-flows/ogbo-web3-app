import { useCallback, useRef } from 'react'

/**
 * Hook for tracking IME composition state.
 * Prevents premature actions (search, save) during CJK input composition.
 *
 * Usage: bind onCompositionStart/onCompositionEnd to input elements,
 * and check isComposingRef.current before triggering debounced actions.
 */
export function useIMEComposition() {
  const isComposingRef = useRef(false)

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const onCompositionEnd = useCallback(() => {
    isComposingRef.current = false
  }, [])

  return {
    isComposingRef,
    onCompositionStart,
    onCompositionEnd,
  }
}
