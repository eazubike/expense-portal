/**
 * CSV generation and download utilities.
 */

/**
 * Escape a value for CSV format.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 * Doubles any existing quotes.
 */
function escapeCSV(value) {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Generate a CSV string from expense entries.
 * Columns: Week Of, Category, Item, Price, Purchase_Status, Running_Total
 *
 * @param {Array} entries - Array of expense entry objects (should include runningTotal)
 * @returns {string} CSV string with UTF-8 BOM for Excel compatibility
 */
export function generateCSV(entries) {
  if (!entries || entries.length === 0) return ''

  // Sort entries by weekOf then createdAt
  const sorted = [...entries].sort((a, b) => {
    if (a.weekOf !== b.weekOf) return a.weekOf.localeCompare(b.weekOf)
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  })

  // Calculate running totals if not already present
  let runningTotal = 0
  const withTotals = sorted.map((entry) => {
    if (entry.purchased) {
      runningTotal += entry.price || 0
    }
    return { ...entry, _runningTotal: entry.runningTotal ?? runningTotal }
  })

  const headers = ['Week Of', 'Category', 'Item', 'Price', 'Purchase_Status', 'Running_Total']
  const headerRow = headers.map(escapeCSV).join(',')

  const dataRows = withTotals.map((entry) => {
    const row = [
      entry.weekOf || '',
      entry.category || '',
      entry.item || '',
      entry.price != null ? entry.price.toFixed(2) : '0.00',
      entry.purchased ? 'Bought' : 'Not Bought',
      entry._runningTotal != null ? entry._runningTotal.toFixed(2) : '0.00',
    ]
    return row.map(escapeCSV).join(',')
  })

  const csvContent = [headerRow, ...dataRows].join('\r\n')

  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF'
  return BOM + csvContent
}

/**
 * Trigger a browser download of a CSV string.
 *
 * @param {string} csvString - The CSV content to download
 * @param {string} filename - The filename (should end in .csv)
 */
export function downloadCSV(csvString, filename = 'expenses.csv') {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, 100)
}
