import { useState, useMemo } from 'react'
import { formatCurrency } from '../../utils/formatters'
import { formatWeekDate } from '../../utils/dateUtils'
import { buildReconciliationMessage, shareToWhatsApp } from '../../utils/whatsappShare'
import CurrencyDisplay from '../common/CurrencyDisplay'

/**
 * Full-screen reconciliation modal.
 * Shows all items from a paid week with toggles for Bought/Not Bought.
 */
export default function ReconciliationModal({
  weekOf,
  weekStart,
  expenses = [],
  onReconcile,
  onClose,
  isSubmitting = false,
}) {
  // Initialize all items as "bought" by default
  const [itemStatuses, setItemStatuses] = useState(() =>
    expenses.reduce((acc, entry) => {
      acc[entry.entryId] = true // default all to bought
      return acc
    }, {})
  )
  const [isComplete, setIsComplete] = useState(false)

  // Calculate totals
  const { boughtItems, notBoughtItems, finalTotal } = useMemo(() => {
    const bought = []
    const notBought = []
    let total = 0

    for (const entry of expenses) {
      if (itemStatuses[entry.entryId]) {
        bought.push(entry)
        total += entry.price || 0
      } else {
        notBought.push(entry)
      }
    }

    return { boughtItems: bought, notBoughtItems: notBought, finalTotal: total }
  }, [expenses, itemStatuses])

  function toggleItem(entryId) {
    setItemStatuses((prev) => ({
      ...prev,
      [entryId]: !prev[entryId],
    }))
  }

  function confirmAll() {
    const allBought = expenses.reduce((acc, entry) => {
      acc[entry.entryId] = true
      return acc
    }, {})
    setItemStatuses(allBought)
  }

  async function handleSubmit() {
    const items = expenses.map((entry) => ({
      entryId: entry.entryId,
      purchased: !!itemStatuses[entry.entryId],
    }))

    try {
      await onReconcile(items)
      setIsComplete(true)
    } catch (err) {
      console.error('Reconciliation failed:', err)
    }
  }

  function handleShareReconciliation() {
    const weekDate = formatWeekDate(weekStart)
    const message = buildReconciliationMessage(weekDate, boughtItems, notBoughtItems, finalTotal)
    shareToWhatsApp(message)
  }

  // Completion screen
  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Week Reconciled</h2>
          <p className="text-sm text-gray-600 mb-6">
            {boughtItems.length} of {expenses.length} items purchased.
            Final total: {formatCurrency(finalTotal)}
          </p>

          <div className="space-y-3 w-full max-w-xs">
            <button
              type="button"
              onClick={handleShareReconciliation}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors"
            >
              📱 Share Reconciliation
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button
            type="button"
            onClick={onClose}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900">Reconcile Purchases</h2>
            <p className="text-xs text-gray-500">{formatWeekDate(weekStart)}</p>
          </div>

          <button
            type="button"
            onClick={confirmAll}
            className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded hover:bg-green-100"
          >
            Select All
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
        <div className="max-w-lg mx-auto flex items-center justify-between text-xs">
          <span className="text-green-700">✅ Bought: {boughtItems.length}</span>
          <span className="text-red-600">❌ Not bought: {notBoughtItems.length}</span>
          <CurrencyDisplay amount={finalTotal} size="sm" className="text-gray-900 font-semibold" />
        </div>
      </div>

      {/* SUBMIT BUTTON — prominent, always visible before the list */}
      <div className="bg-white px-4 py-3 border-b border-gray-200">
        <div className="max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full px-4 py-4 text-base font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Submitting...' : `✅ Confirm Reconciliation (${formatCurrency(finalTotal)})`}
          </button>
        </div>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto divide-y divide-gray-100">
          {expenses.map((entry) => {
            const isBought = itemStatuses[entry.entryId]
            return (
              <div
                key={entry.entryId}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Toggle button */}
                <button
                  type="button"
                  onClick={() => toggleItem(entry.entryId)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isBought
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-red-100 text-red-700 border-2 border-red-300'
                  }`}
                  aria-label={isBought ? 'Mark as not bought' : 'Mark as bought'}
                >
                  {isBought ? '✓' : '✗'}
                </button>

                {/* Item info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${!isBought ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {entry.item}
                  </p>
                  <span className="text-[10px] text-gray-500">{entry.category}</span>
                </div>

                {/* Price */}
                <span className={`text-sm font-mono ${!isBought ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {formatCurrency(entry.price)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
