/**
 * Currency and display formatting utilities.
 */

/**
 * Format a number as Nigerian Naira (₦).
 * @param {number} amount
 * @param {boolean} showDecimal - Whether to show decimal places (default: true for amounts with kobo)
 * @returns {string} e.g. "₦15,000.00" or "₦15,000"
 */
export function formatCurrency(amount, showDecimal = false) {
  if (amount == null || isNaN(amount)) return '₦0'

  const options = {
    minimumFractionDigits: showDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  }

  const formatted = Number(amount).toLocaleString('en-NG', options)
  return `₦${formatted}`
}

/**
 * Parse a price string into a number.
 * Removes currency symbols, commas, and whitespace.
 * @param {string} value
 * @returns {number|null}
 */
export function parsePrice(value) {
  if (!value) return null
  const cleaned = String(value).replace(/[₦,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

/**
 * Format a number with commas for display in input fields.
 * @param {number} value
 * @returns {string}
 */
export function formatNumberInput(value) {
  if (value == null || isNaN(value)) return ''
  return Number(value).toLocaleString('en-NG')
}

/**
 * Truncate text with ellipsis.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function truncate(text, maxLength = 30) {
  if (!text || text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}
