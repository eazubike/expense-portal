import { useState } from 'react'
import { CATEGORIES } from '../../data/itemCatalog'
import { formatCurrency } from '../../utils/formatters'

const CATEGORY_COLORS = {
  'Food': 'bg-orange-100 text-orange-700',
  'Provision': 'bg-blue-100 text-blue-700',
  'Others': 'bg-purple-100 text-purple-700',
  "Mom's Drugs & Hosp. Exp": 'bg-pink-100 text-pink-700',
  "Dad's Drugs & Hosp. Exp": 'bg-teal-100 text-teal-700',
}

/**
 * Preview generated entries from a template, allow edits before confirming batch create.
 */
export default function ApplyTemplate({ template, weekOf, onConfirm, onCancel, isApplying }) {
  const [entries, setEntries] = useState(
    template.items.map((item) => ({
      ...item,
      price: String(item.price),
      included: true,
    }))
  )

  function handleToggleInclude(index) {
    const updated = [...entries]
    updated[index] = { ...updated[index], included: !updated[index].included }
    setEntries(updated)
  }

  function handlePriceChange(index, value) {
    const updated = [...entries]
    updated[index] = { ...updated[index], price: value }
    setEntries(updated)
  }

  function handleItemChange(index, value) {
    const updated = [...entries]
    updated[index] = { ...updated[index], item: value }
    setEntries(updated)
  }

  function handleConfirm() {
    const includedEntries = entries
      .filter((e) => e.included)
      .map((e) => ({
        category: e.category,
        item: e.item.trim(),
        price: parseFloat(e.price),
        purchased: false,
        weekOf,
      }))
      .filter((e) => e.item && !isNaN(e.price) && e.price > 0)

    if (includedEntries.length === 0) return
    onConfirm(includedEntries)
  }

  const includedCount = entries.filter((e) => e.included).length
  const totalPrice = entries
    .filter((e) => e.included)
    .reduce((sum, e) => {
      const price = parseFloat(e.price)
      return sum + (isNaN(price) ? 0 : price)
    }, 0)

  return (
    <div className="px-4 py-4 bg-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Apply Template</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {template.name} · {includedCount} of {entries.length} items selected
          </p>
        </div>
        <span className="text-sm font-medium text-green-700">
          {formatCurrency(totalPrice)}
        </span>
      </div>

      {/* Entry list with toggles */}
      <div className="space-y-2 max-h-[55vh] overflow-y-auto mb-4">
        {entries.map((entry, idx) => {
          const categoryColor = CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-700'

          return (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                entry.included
                  ? 'bg-white border-gray-200'
                  : 'bg-gray-50 border-gray-100 opacity-60'
              }`}
            >
              {/* Include toggle */}
              <button
                type="button"
                onClick={() => handleToggleInclude(idx)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  entry.included
                    ? 'bg-green-600 border-green-600'
                    : 'border-gray-300'
                }`}
                aria-label={entry.included ? `Exclude ${entry.item}` : `Include ${entry.item}`}
              >
                {entry.included && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Item details */}
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={entry.item}
                  onChange={(e) => handleItemChange(idx, e.target.value)}
                  disabled={!entry.included}
                  className="w-full text-sm font-medium text-gray-900 bg-transparent border-none p-0 focus:outline-none focus:ring-0 disabled:text-gray-400"
                  aria-label={`Item name ${idx + 1}`}
                />
                <span className={`inline-block mt-0.5 px-1.5 py-0.5 text-[10px] font-medium rounded ${categoryColor}`}>
                  {entry.category}
                </span>
              </div>

              {/* Price */}
              <input
                type="number"
                inputMode="decimal"
                value={entry.price}
                onChange={(e) => handlePriceChange(idx, e.target.value)}
                disabled={!entry.included}
                className="w-20 text-right text-sm font-mono px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
                style={{ fontSize: '16px' }}
                aria-label={`Price for ${entry.item}`}
              />
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          disabled={isApplying}
          className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isApplying || includedCount === 0}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 transition-colors disabled:opacity-50"
        >
          {isApplying ? 'Adding...' : `Add ${includedCount} Item${includedCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
