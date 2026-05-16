import apiClient from './client'

/**
 * Get all expense entries for a given week.
 * @param {string} weekOf - ISO date of Sunday (e.g. "2026-02-22")
 * @returns {Promise<Array>}
 */
export async function getExpenses(weekOf) {
  const { data } = await apiClient.get('/expenses', { params: { weekOf } })
  return data.entries || data || []
}

/**
 * Get expenses for a date range.
 * @param {string} from - ISO date
 * @param {string} to - ISO date
 * @returns {Promise<Array>}
 */
export async function getExpensesByRange(from, to) {
  const { data } = await apiClient.get('/expenses', { params: { from, to } })
  return data.entries || data || []
}

/**
 * Create a new expense entry.
 * @param {object} entry - { category, item, price, purchased }
 * @returns {Promise<object>}
 */
export async function createExpense(entry) {
  const { data } = await apiClient.post('/expenses', entry)
  return data.entry || data
}

/**
 * Update an existing expense entry.
 * @param {string} weekOf
 * @param {string} entryId
 * @param {object} updates - Partial entry fields to update
 * @returns {Promise<object>}
 */
export async function updateExpense(weekOf, entryId, updates) {
  const { data } = await apiClient.put(`/expenses/${weekOf}/${entryId}`, updates)
  return data
}

/**
 * Delete an expense entry.
 * @param {string} weekOf
 * @param {string} entryId
 * @returns {Promise<void>}
 */
export async function deleteExpense(weekOf, entryId) {
  await apiClient.delete(`/expenses/${weekOf}/${entryId}`)
}

/**
 * Create multiple expense entries at once (template apply).
 * @param {Array} entries - Array of { category, item, price, purchased }
 * @returns {Promise<Array>}
 */
export async function batchCreateExpenses(entries) {
  const { data } = await apiClient.post('/expenses/batch', { entries })
  return data
}

/**
 * Add a custom item to the catalog.
 * @param {string} category
 * @param {string} item
 * @returns {Promise<object>}
 */
export async function addCustomItem(category, item) {
  const { data } = await apiClient.post('/items', { category, item })
  return data
}

/**
 * Get all custom items (merged with built-in catalog).
 * Returns object grouped by category: { "Food": ["item1", ...], ... }
 * @returns {Promise<object>}
 */
export async function getCustomItems() {
  const { data } = await apiClient.get('/items')
  const items = data.items || []
  // Group by category into { category: [itemName, ...] }
  const grouped = {}
  for (const entry of items) {
    if (!grouped[entry.category]) grouped[entry.category] = []
    grouped[entry.category].push(entry.item)
  }
  return grouped
}
