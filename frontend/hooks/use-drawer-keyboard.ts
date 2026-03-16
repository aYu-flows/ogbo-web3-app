'use client'

import { useState, useEffect } from 'react'

/**
 * Hook that detects keyboard height for Drawer components.
 * On Capacitor native: uses @capacitor/keyboard plugin events.
 * On web: uses visualViewport resize event.
 * Returns keyboardHeight (px) to apply as paddingBottom on Drawer content.
 */
export function useDrawerKeyboard(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    let mounted = true
    const handles: { remove: () => Promise<void> }[] = []

    // Try Capacitor Keyboard plugin first (native platforms)
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) throw new Error('not native')
        return import('@capacitor/keyboard')
      })
      .then(({ Keyboard }) => {
        if (!mounted) return

        Keyboard.addListener('keyboardWillShow', (info) => {
          if (!mounted) return
          setKeyboardHeight(info.keyboardHeight)
        }).then((h) => {
          if (mounted) handles.push(h)
          else h.remove()
        })

        Keyboard.addListener('keyboardDidHide', () => {
          if (!mounted) return
          setKeyboardHeight(0)
        }).then((h) => {
          if (mounted) handles.push(h)
          else h.remove()
        })
      })
      .catch(() => {
        // Not on native platform — use visualViewport fallback for web
        if (!mounted || typeof window === 'undefined') return
        const vv = window.visualViewport
        if (!vv) return

        const onResize = () => {
          if (!mounted) return
          // When keyboard opens, visualViewport.height shrinks
          const diff = window.innerHeight - vv.height
          setKeyboardHeight(diff > 50 ? diff : 0)
        }

        vv.addEventListener('resize', onResize)
        handles.push({
          remove: async () => {
            vv.removeEventListener('resize', onResize)
          },
        })
      })

    return () => {
      mounted = false
      handles.forEach((h) => h.remove())
    }
  }, [])

  return keyboardHeight
}
