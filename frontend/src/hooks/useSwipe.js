import { useRef, useCallback } from 'react'

/**
 * Touch swipe detection hook.
 * Returns handlers to attach to a swipeable element.
 *
 * @param {object} options
 * @param {function} options.onSwipeLeft - Called when user swipes left
 * @param {function} options.onSwipeRight - Called when user swipes right
 * @param {number} options.threshold - Minimum distance in px to trigger (default: 50)
 * @returns {{ onTouchStart, onTouchMove, onTouchEnd }}
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 50 } = {}) {
  const touchStart = useRef({ x: 0, y: 0 })
  const touchEnd = useRef({ x: 0, y: 0 })

  const onTouchStart = useCallback((e) => {
    const touch = e.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
    touchEnd.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchMove = useCallback((e) => {
    const touch = e.touches[0]
    touchEnd.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const onTouchEnd = useCallback(() => {
    const deltaX = touchEnd.current.x - touchStart.current.x
    const deltaY = touchEnd.current.y - touchStart.current.y

    // Only trigger if horizontal movement is greater than vertical
    if (Math.abs(deltaX) < Math.abs(deltaY)) return
    if (Math.abs(deltaX) < threshold) return

    if (deltaX < 0 && onSwipeLeft) {
      onSwipeLeft()
    } else if (deltaX > 0 && onSwipeRight) {
      onSwipeRight()
    }
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
