import { formatCurrency } from '../../utils/formatters'

/**
 * Displays the audit trail of items removed by the approver.
 * Shows removed items with who removed them and when.
 */
export default function RemovalAuditTrail({ removals = [], onShareChanges }) {
  if (removals.length === 0) return null

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg mx-4 my-3 overflow-hidden">
      <div className="px-4 py-2 bg-red-100 border-b border-red-200 flex items-center justify-between">
        <h3 className="text-sm font-medium text-red-800">
          ✂️ Removed Items ({removals.length})
        </h3>
        {onShareChanges && (
          <button
            type="button"
            onClick={onShareChanges}
            className="px-2.5 py-1 text-xs font-medium text-red-700 bg-white border border-red-300 rounded hover:bg-red-50 transition-colors"
          >
            Share Changes
          </button>
        )}
      </div>

      <div className="divide-y divide-red-100">
        {removals.map((removal, index) => (
          <div key={`${removal.entryId}-${index}`} className="px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-900 truncate">
                  {removal.item}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-red-600">
                    {removal.category}
                  </span>
                  <span className="text-[10px] text-red-500">
                    by {removal.removedByName}
                  </span>
                  <span className="text-[10px] text-red-400">
                    {formatRemovalDate(removal.removedAt)}
                  </span>
                </div>
                {removal.reason && (
                  <p className="text-[10px] text-red-500 mt-0.5 italic">
                    Reason: {removal.reason}
                  </p>
                )}
              </div>
              <span className="text-sm font-mono text-red-700 line-through">
                {formatCurrency(removal.price)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Format a removal timestamp for display.
 */
function formatRemovalDate(isoString) {
  if (!isoString) return ''
  try {
    const date = new Date(isoString)
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
