/**
 * Input validation utilities.
 */

const CATEGORIES = [
  'Food',
  'Provision',
  'Others',
  "Mom's Drugs & Hosp. Exp",
  "Dad's Drugs & Hosp. Exp",
]

/**
 * Validate that a category is a non-empty string (max 50 chars).
 * Categories are now dynamic (stored in settings table), so we only
 * validate format here. The frontend enforces the actual list.
 */
export function isValidCategory(category) {
  return typeof category === 'string' && category.trim().length > 0 && category.length <= 50
}

/**
 * Validate price: must be a number between 0.01 and 999,999,999.99
 * with at most 2 decimal places.
 */
export function isValidPrice(price) {
  if (typeof price !== 'number' || !isFinite(price)) return false
  if (price < 0.01 || price > 999_999_999.99) return false
  // Check at most 2 decimal places
  const decimalStr = price.toString()
  const decimalPart = decimalStr.split('.')[1]
  if (decimalPart && decimalPart.length > 2) return false
  return true
}

/**
 * Validate item name: string between 1 and 100 characters.
 */
export function isValidItem(item) {
  return typeof item === 'string' && item.trim().length >= 1 && item.length <= 100
}

/**
 * Validate weekOf: must be a valid ISO date string representing a Sunday.
 */
export function isValidWeekOf(weekOf) {
  if (typeof weekOf !== 'string') return false
  // Must match YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(weekOf)) return false
  const date = new Date(weekOf + 'T00:00:00Z')
  if (isNaN(date.getTime())) return false
  return date.getUTCDay() === 0 // Sunday
}

/**
 * Validate a date string in ISO format (YYYY-MM-DD).
 */
export function isValidDateString(dateStr) {
  if (typeof dateStr !== 'string') return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) return false
  const date = new Date(dateStr + 'T00:00:00Z')
  return !isNaN(date.getTime())
}

/**
 * Validate receiptKeys: must be an array of strings with max 3 entries.
 */
export function isValidReceiptKeys(receiptKeys) {
  if (!Array.isArray(receiptKeys)) return false
  if (receiptKeys.length > 3) return false
  return receiptKeys.every((key) => typeof key === 'string' && key.length > 0)
}

/**
 * Validate a full expense entry for creation.
 * Returns an array of error messages, or null if valid.
 */
export function validateExpenseEntry(data) {
  const errors = []

  if (!data.category || !isValidCategory(data.category)) {
    errors.push("Category must be a non-empty string (max 50 characters)")
  }
  if (!data.item || !isValidItem(data.item)) {
    errors.push('Item must be 1-100 characters')
  }
  if (data.price === undefined || data.price === null || !isValidPrice(data.price)) {
    errors.push('Price must be a number between 0.01 and 999,999,999.99 with at most 2 decimal places')
  }
  if (!data.weekOf || !isValidWeekOf(data.weekOf)) {
    errors.push('weekOf must be a valid Sunday date in YYYY-MM-DD format')
  }

  return errors.length > 0 ? errors : null
}

/**
 * Validate fields allowed for expense update.
 * Returns an array of error messages, or null if valid.
 */
export function validateExpenseUpdate(data) {
  const errors = []
  const allowedFields = ['category', 'item', 'price', 'purchased', 'receiptKeys']
  const providedFields = Object.keys(data)

  // Check for disallowed fields
  const disallowed = providedFields.filter((f) => !allowedFields.includes(f))
  if (disallowed.length > 0) {
    errors.push(`Cannot update fields: ${disallowed.join(', ')}`)
  }

  // Must provide at least one field to update
  const updateFields = providedFields.filter((f) => allowedFields.includes(f))
  if (updateFields.length === 0) {
    errors.push('Must provide at least one field to update: category, item, price, purchased, receiptKeys')
  }

  // Validate individual fields if provided
  if (data.category !== undefined && !isValidCategory(data.category)) {
    errors.push("Category must be a non-empty string (max 50 characters)")
  }
  if (data.item !== undefined && !isValidItem(data.item)) {
    errors.push('Item must be 1-100 characters')
  }
  if (data.price !== undefined && !isValidPrice(data.price)) {
    errors.push('Price must be a number between 0.01 and 999,999,999.99 with at most 2 decimal places')
  }
  if (data.purchased !== undefined && typeof data.purchased !== 'boolean') {
    errors.push('purchased must be a boolean')
  }
  if (data.receiptKeys !== undefined && !isValidReceiptKeys(data.receiptKeys)) {
    errors.push('receiptKeys must be an array of strings with max 3 entries')
  }

  return errors.length > 0 ? errors : null
}

/**
 * Validate a custom item for creation.
 * Returns an array of error messages, or null if valid.
 */
export function validateCustomItem(data) {
  const errors = []

  if (!data.category || !isValidCategory(data.category)) {
    errors.push("Category must be a non-empty string (max 50 characters)")
  }
  if (!data.item || !isValidItem(data.item)) {
    errors.push('Item must be 1-100 characters')
  }

  return errors.length > 0 ? errors : null
}

export { CATEGORIES }
