import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getExpensesByRange } from '../../api/expenses'
import { formatCurrency } from '../../utils/formatters'
import { toISODate, getWeekStart } from '../../utils/dateUtils'

/**
 * Smart Templates — auto-generated from the last 3 months of data.
 * Shows most recurring items per category with their average price.
 */
export default function SmartTemplates({ onApplyItems }) {
  const [expandedCat, setExpandedCat] = useState(null)
  const [appliedCats, setAppliedCats] = useState(new Set())
  const [applying, setApplying] = useState(null)

  // Get date range for last 3 months
  const { from, to } = useMemo(() => {
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const fromSunday = getWeekStart(threeMonthsAgo)
    return { from: toISODate(fromSunday), to: toISODate(now) }
  }, [])

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses-range', from, to],
    queryFn: () => getExpensesByRange(from, to),
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  // Compute smart templates per category
  const smartTemplates = useMemo(() => {
    if (expenses.length === 0) return []

    // Count weeks in the range
    const weekSet = new Set(expenses.map(e => e.weekOf))
    const totalWeeks = weekSet.size || 1

    // Group by category, then by item
    const catItems = {}
    for (const e of expenses) {
      const cat = e.category || 'Others'
      if (!catItems[cat]) catItems[cat] = {}
      if (!catItems[cat][e.item]) catItems[cat][e.item] = { total: 0, count: 0, weeks: new Set() }
      catItems[cat][e.item].total += e.price || 0
      catItems[cat][e.item].count += 1
      catItems[cat][e.item].weeks.add(e.weekOf)
    }

    // Build templates: items appearing in 50%+ of weeks
    const templates = []
    for (const [cat, items] of Object.entries(catItems)) {
      const recurring = Object.entries(items)
        .map(([name, data]) => ({
          name,
          frequency: data.weeks.size,
          frequencyPct: Math.round((data.weeks.size / totalWeeks) * 100),
          avgPrice: Math.round(data.total / data.count),
          totalSpent: data.total,
        }))
        .filter(item => item.frequency >= 3) // appeared at least 3 weeks
        .sort((a, b) => b.frequency - a.frequency)

      if (recurring.length > 0) {
        const templateTotal = recurring.reduce((s, i) => s + i.avgPrice, 0)
        templates.push({ category: cat, items: recurring, total: templateTotal })
      }
    }

    // Sort categories by total descending
    templates.sort((a, b) => b.total - a.total)
    return templates
  }, [expenses])

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-2 text-xs text-gray-500">Analyzing last 3 months...</p>
      </div>
    )
  }

  if (smartTemplates.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-gray-500">Not enough data to generate smart templates yet.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {smartTemplates.map((tmpl) => {
        const isExpanded = expandedCat === tmpl.category
        return (
          <div key={tmpl.category} className="bg-white">
            {/* Category header */}
            <button
              type="button"
              onClick={() => setExpandedCat(isExpanded ? null : tmpl.category)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{tmpl.category}</p>
                <p className="text-xs text-gray-500">
                  {tmpl.items.length} recurring items · ~{formatCurrency(tmpl.total)}/week
                </p>
              </div>
              <span className="text-gray-400 text-sm">{isExpanded ? '▾' : '▸'}</span>
            </button>

            {/* Expanded: show items + apply button */}
            {isExpanded && (
              <div className="px-4 pb-3 space-y-2">
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {tmpl.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-xs text-gray-800 truncate">{item.name}</span>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">
                          {item.frequencyPct}% of weeks
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-700 flex-shrink-0">
                        ~{formatCurrency(item.avgPrice)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Apply button */}
                {appliedCats.has(tmpl.category) ? (
                  <p className="w-full py-2 text-sm font-medium text-green-700 text-center">
                    ✓ Applied {tmpl.items.length} items to this week
                  </p>
                ) : (
                  <button
                    type="button"
                    disabled={applying === tmpl.category}
                    onClick={async () => {
                      setApplying(tmpl.category)
                      const items = tmpl.items.map(i => ({
                        category: tmpl.category,
                        item: i.name,
                        price: i.avgPrice,
                        purchased: false,
                      }))
                      await onApplyItems(items)
                      setAppliedCats(prev => new Set([...prev, tmpl.category]))
                      setApplying(null)
                    }}
                    className="w-full py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 disabled:opacity-50 transition-colors"
                  >
                    {applying === tmpl.category ? 'Applying...' : `Apply ${tmpl.items.length} items as draft`}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
