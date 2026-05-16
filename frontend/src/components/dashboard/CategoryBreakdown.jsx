import { useState, useMemo } from 'react'
import { formatCurrency } from '../../utils/formatters'

const CATEGORY_BAR_COLORS = {
  'Food': { bg: 'bg-orange-100', bar: 'bg-orange-500', text: 'text-orange-700' },
  'Provision': { bg: 'bg-blue-100', bar: 'bg-blue-500', text: 'text-blue-700' },
  'Others': { bg: 'bg-purple-100', bar: 'bg-purple-500', text: 'text-purple-700' },
  "Mom's Drugs & Hosp. Exp": { bg: 'bg-pink-100', bar: 'bg-pink-500', text: 'text-pink-700' },
  "Dad's Drugs & Hosp. Exp": { bg: 'bg-teal-100', bar: 'bg-teal-500', text: 'text-teal-700' },
}

const FALLBACK_COLORS = [
  { bg: 'bg-yellow-100', bar: 'bg-yellow-500', text: 'text-yellow-700' },
  { bg: 'bg-red-100', bar: 'bg-red-500', text: 'text-red-700' },
  { bg: 'bg-indigo-100', bar: 'bg-indigo-500', text: 'text-indigo-700' },
  { bg: 'bg-lime-100', bar: 'bg-lime-500', text: 'text-lime-700' },
  { bg: 'bg-cyan-100', bar: 'bg-cyan-500', text: 'text-cyan-700' },
]

const DEFAULT_COLORS = { bg: 'bg-gray-100', bar: 'bg-gray-500', text: 'text-gray-700' }

function getCategoryColors(category, index) {
  if (CATEGORY_BAR_COLORS[category]) return CATEGORY_BAR_COLORS[category]
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length] || DEFAULT_COLORS
}

/**
 * Category breakdown with tap-to-drill-down showing top items (80% Pareto).
 */
export default function CategoryBreakdown({ breakdown, totalSpent }) {
  const [expandedCategory, setExpandedCategory] = useState(null)

  if (!breakdown || Object.keys(breakdown).length === 0) return null

  const sortedCategories = Object.entries(breakdown).sort(
    ([, a], [, b]) => b.total - a.total
  )

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-900">Category Breakdown</h3>
      <p className="text-[10px] text-gray-400">Tap a category to see top items</p>

      {sortedCategories.map(([category, data], index) => {
        const percentage = totalSpent > 0 ? (data.total / totalSpent) * 100 : 0
        const colors = getCategoryColors(category, index)
        const isExpanded = expandedCategory === category

        return (
          <div key={category}>
            <button
              type="button"
              onClick={() => setExpandedCategory(isExpanded ? null : category)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-medium ${colors.text}`}>
                  {category} {isExpanded ? '▾' : '▸'}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {data.count} item{data.count !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-medium text-gray-900">
                    {formatCurrency(data.total)}
                  </span>
                </div>
              </div>

              <div className={`w-full h-2 rounded-full ${colors.bg}`}>
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${colors.bar}`}
                  style={{ width: `${Math.min(percentage, 100)}%` }}
                />
              </div>

              <p className="mt-0.5 text-[10px] text-gray-400 text-right">
                {percentage.toFixed(1)}%
              </p>
            </button>

            {/* Drill-down: top items making up 80% */}
            {isExpanded && (
              <ParetoItems items={data.items} categoryTotal={data.total} colors={colors} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Shows items that make up 80% of a category's spending (Pareto principle).
 */
function ParetoItems({ items, categoryTotal, colors }) {
  const paretoData = useMemo(() => {
    // Aggregate by item name
    const itemTotals = {}
    for (const entry of items) {
      const name = entry.item || 'Unknown'
      if (!itemTotals[name]) itemTotals[name] = { total: 0, count: 0 }
      itemTotals[name].total += entry.price || 0
      itemTotals[name].count += 1
    }

    // Sort by total descending
    const sorted = Object.entries(itemTotals)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)

    // Find items making up 80%
    const threshold = categoryTotal * 0.8
    let cumulative = 0
    const topItems = []
    for (const item of sorted) {
      topItems.push({ ...item, cumulative: cumulative + item.total })
      cumulative += item.total
      if (cumulative >= threshold) break
    }

    return { topItems, totalItems: sorted.length }
  }, [items, categoryTotal])

  return (
    <div className="mt-2 mb-3 ml-2 pl-3 border-l-2 border-gray-200 space-y-1.5">
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
        Top items (80% of spend) — {paretoData.topItems.length} of {paretoData.totalItems} items
      </p>
      {paretoData.topItems.map((item, idx) => {
        const pct = categoryTotal > 0 ? (item.total / categoryTotal) * 100 : 0
        return (
          <div key={item.name} className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-[10px] text-gray-400 w-4 flex-shrink-0">{idx + 1}.</span>
              <span className="text-xs text-gray-800 truncate">{item.name}</span>
              <span className="text-[10px] text-gray-400">×{item.count}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-mono text-gray-700">{formatCurrency(item.total)}</span>
              <span className={`text-[10px] font-medium ${colors.text}`}>{pct.toFixed(0)}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
