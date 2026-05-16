import { usePullToRefresh } from '../../hooks/usePullToRefresh'

/**
 * Wrapper component that adds pull-to-refresh behavior to its children.
 * Shows a spinner indicator when pulling down from the top of the page.
 *
 * @param {object} props
 * @param {function} props.onRefresh - Async callback invoked on refresh (e.g., invalidate React Query cache)
 * @param {React.ReactNode} props.children
 */
export default function PullToRefresh({ onRefresh, children }) {
  const { isRefreshing, pullDistance, handlers } = usePullToRefresh({
    onRefresh,
    threshold: 80,
  })

  const showSpinner = isRefreshing || pullDistance > 20

  return (
    <div {...handlers} className="relative">
      {/* Pull indicator */}
      {showSpinner && (
        <div
          className="flex items-center justify-center transition-all duration-200"
          style={{
            height: isRefreshing ? 48 : Math.min(pullDistance, 48),
            opacity: isRefreshing ? 1 : Math.min(pullDistance / 60, 1),
          }}
        >
          <svg
            className={`w-6 h-6 text-green-700 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{
              transform: isRefreshing
                ? undefined
                : `rotate(${Math.min(pullDistance * 3, 360)}deg)`,
            }}
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}

      {children}
    </div>
  )
}
