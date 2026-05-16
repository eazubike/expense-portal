import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Hook for pull-to-refresh gesture detection.
 * Detects a pull-down gesture when the page is scrolled to the top.
 *
 * @param {object} options
 * @param {function} options.onRefresh - Async callback to invoke on refresh
 * @param {number} options.threshold - Pull distance in px to trigger refresh (default: 80)
 * @returns {{ isRefreshing: boolean, pullDistance: number, handlers: object }}
 */
export function usePullToRefresh({ onRefresh, threshold = 80 } = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    // Only activate when scrolled to the top
    if (window.scrollY <= 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY
      pulling.current = true
    }
  }, [isRefreshing])

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current) return

    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startY.current)

    // Apply resistance — diminishing returns as you pull further
    const dampened = Math.min(distance * 0.5, threshold * 1.5)
    setPullDistance(dampened)
  }, [threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return
    pulling.current = false

    if (pullDistance >= threshold && onRefresh) {
      setIsRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }

    setPullDistance(0)
  }, [pullDistance, threshold, onRefresh])

  // Reset pull distance when refreshing completes
  useEffect(() => {
    if (!isRefreshing) {
      setPullDistance(0)
    }
  }, [isRefreshing])

  const handlers = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }

  return { isRefreshing, pullDistance, handlers }
}
