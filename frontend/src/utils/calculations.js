/**
 * Running total and expense calculation utilities.
 */

/**
 * Calculate running totals for expense entries.
 * Sorts entries by weekOf then createdAt, and only includes
 * entries with purchased=true in the running total.
 *
 * @param {Array} entries - Array of expense entry objects
 * @returns {Array} Entries with a `runningTotal` field added to each
 */
export function calculateRunningTotals(entries) {
  if (!entries || entries.length === 0) return []

  // Sort by weekOf then createdAt
  const sorted = [...entries].sort((a, b) => {
    if (a.weekOf !== b.weekOf) return a.weekOf.localeCompare(b.weekOf)
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  let runningTotal = 0

  return sorted.map((entry) => {
    if (entry.purchased) {
      runningTotal += entry.price || 0
    }
    return { ...entry, runningTotal }
  })
}

/**
 * Calculate the total of purchased items only.
 * @param {Array} entries
 * @returns {number}
 */
export function calculatePurchasedTotal(entries) {
  if (!entries || entries.length === 0) return 0
  return entries
    .filter((e) => e.purchased)
    .reduce((sum, e) => sum + (e.price || 0), 0)
}

/**
 * Calculate category breakdown for a set of entries.
 * @param {Array} entries
 * @returns {Object} { categoryName: { total, count, items } }
 */
export function calculateCategoryBreakdown(entries) {
  if (!entries || entries.length === 0) return {}

  return entries.reduce((acc, entry) => {
    const cat = entry.category || 'Others'
    if (!acc[cat]) {
      acc[cat] = { total: 0, count: 0, items: [] }
    }
    acc[cat].total += entry.price || 0
    acc[cat].count += 1
    acc[cat].items.push(entry)
    return acc
  }, {})
}
