/**
 * Expense entries Lambda handler.
 * Handles CRUD operations for expense entries.
 *
 * Routes:
 *   GET    /expenses?weekOf={date}          — Get all entries for a specific week
 *   GET    /expenses?from={date}&to={date}  — Get entries for a date range
 *   POST   /expenses                        — Create new expense entry
 *   PUT    /expenses/{weekOf}/{entryId}     — Update an entry
 *   DELETE /expenses/{weekOf}/{entryId}     — Delete an entry
 *   POST   /expenses/batch                  — Create multiple entries (template apply)
 */

import { randomUUID } from 'crypto'
import { withAuth } from '../middleware/authMiddleware.js'
import { getItem, putItem, queryItems, deleteItem, scanTable, TABLES } from '../services/dynamodb.js'
import { success, error, notFound } from '../utils/responses.js'
import {
  validateExpenseEntry,
  validateExpenseUpdate,
  isValidWeekOf,
  isValidDateString,
} from '../utils/validators.js'

/**
 * Main Lambda handler — routes based on HTTP method and resource path.
 */
export const handler = withAuth(async (event) => {
  const { httpMethod, pathParameters, queryStringParameters, body } = event
  const resource = event.resource || ''

  try {
    // POST /expenses/batch — batch create
    if (httpMethod === 'POST' && resource.endsWith('/batch')) {
      return await batchCreateExpenses(event, parseBody(body))
    }

    switch (httpMethod) {
      case 'GET':
        return await getExpenses(queryStringParameters)
      case 'POST':
        return await createExpense(event, parseBody(body))
      case 'PUT':
        return await updateExpense(event, pathParameters, parseBody(body))
      case 'DELETE':
        return await deleteExpenseEntry(event, pathParameters, queryStringParameters)
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Expense handler error:', err)
    return error('Internal server error', 500)
  }
})

// ─── GET /expenses ───────────────────────────────────────────────────────────

/**
 * Get expenses by weekOf or date range.
 * - ?weekOf={date} — query by partition key (efficient)
 * - ?from={date}&to={date} — scan with filter (less efficient)
 */
async function getExpenses(params) {
  if (!params) {
    return error('Query parameters required: weekOf or from/to', 400)
  }

  const { weekOf, from, to } = params

  // Query by specific week (uses partition key)
  if (weekOf) {
    if (!isValidWeekOf(weekOf)) {
      return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
    }

    const entries = await queryItems(
      TABLES.entries,
      'weekOf = :weekOf',
      { ':weekOf': weekOf }
    )

    return success({ entries })
  }

  // Query by date range (scan with filter)
  if (from && to) {
    if (!isValidDateString(from) || !isValidDateString(to)) {
      return error('from and to must be valid dates in YYYY-MM-DD format', 400)
    }

    if (from > to) {
      return error('from date must be before or equal to to date', 400)
    }

    const allEntries = await scanTable(TABLES.entries)
    const filtered = allEntries.filter(
      (entry) => entry.weekOf >= from && entry.weekOf <= to
    )

    // Sort by weekOf descending, then by createdAt ascending within each week
    filtered.sort((a, b) => {
      if (a.weekOf !== b.weekOf) return b.weekOf.localeCompare(a.weekOf)
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    return success({ entries: filtered })
  }

  return error('Query parameters required: weekOf or from/to', 400)
}

// ─── POST /expenses ──────────────────────────────────────────────────────────

/**
 * Create a new expense entry.
 * Validates input, generates UUID and timestamps. New entries start as 'draft'.
 */
async function createExpense(event, data) {
  // Validate input
  const validationErrors = validateExpenseEntry(data)
  if (validationErrors) {
    return error(validationErrors.join('; '), 400)
  }

  // Check user role — only inputer (or admin) can create
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can create expense entries', 403)
  }

  const now = new Date().toISOString()
  const entry = {
    weekOf: data.weekOf,
    entryId: randomUUID(),
    category: data.category,
    item: data.item.trim(),
    price: data.price,
    purchased: data.purchased || false,
    status: 'draft',
    createdBy: event.user.userId,
    createdByName: event.user.displayName,
    createdAt: now,
    updatedAt: now,
    receiptKeys: data.receiptKeys || [],
  }

  await putItem(TABLES.entries, entry)

  return success({ entry }, 201)
}

// ─── POST /expenses/batch ────────────────────────────────────────────────────

/**
 * Batch create multiple expense entries (used for template apply).
 * Validates all entries first, then creates them all. New entries start as 'draft'.
 */
async function batchCreateExpenses(event, data) {
  const { entries } = data

  if (!Array.isArray(entries) || entries.length === 0) {
    return error('entries must be a non-empty array', 400)
  }

  if (entries.length > 50) {
    return error('Maximum 50 entries per batch', 400)
  }

  // Check user role
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can create expense entries', 403)
  }

  // Validate all entries first
  const allErrors = []
  for (let i = 0; i < entries.length; i++) {
    const validationErrors = validateExpenseEntry(entries[i])
    if (validationErrors) {
      allErrors.push(`Entry ${i + 1}: ${validationErrors.join('; ')}`)
    }
  }

  if (allErrors.length > 0) {
    return error(allErrors.join(' | '), 400)
  }

  // All entries must be for the same week
  const weekOfs = [...new Set(entries.map((e) => e.weekOf))]
  if (weekOfs.length > 1) {
    return error('All entries in a batch must be for the same week', 400)
  }

  // Create all entries (skip duplicates — items already in this week)
  const now = new Date().toISOString()
  const createdEntries = []

  // Get existing items for this week to check for duplicates
  const existingEntries = await queryItems(
    TABLES.entries,
    'weekOf = :weekOf',
    { ':weekOf': weekOfs[0] }
  )
  const existingItems = new Set(existingEntries.map(e => `${e.category}|${e.item}`))

  for (const entryData of entries) {
    const key = `${entryData.category}|${entryData.item.trim()}`
    if (existingItems.has(key)) {
      continue // Skip duplicate
    }
    existingItems.add(key) // Prevent duplicates within the same batch too

    const entry = {
      weekOf: entryData.weekOf,
      entryId: randomUUID(),
      category: entryData.category,
      item: entryData.item.trim(),
      price: entryData.price,
      purchased: entryData.purchased || false,
      status: 'draft',
      createdBy: event.user.userId,
      createdByName: event.user.displayName,
      createdAt: now,
      updatedAt: now,
      receiptKeys: entryData.receiptKeys || [],
    }

    await putItem(TABLES.entries, entry)
    createdEntries.push(entry)
  }

  return success({ entries: createdEntries, count: createdEntries.length }, 201)
}

// ─── PUT /expenses/{weekOf}/{entryId} ────────────────────────────────────────

/**
 * Update an existing expense entry.
 * Only allowed if entry status is 'draft' (for inputer).
 */
async function updateExpense(event, pathParams, data) {
  const { weekOf, entryId } = pathParams || {}

  if (!weekOf || !entryId) {
    return error('Missing path parameters: weekOf and entryId required', 400)
  }

  if (!isValidWeekOf(weekOf)) {
    return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
  }

  // Validate update fields
  const validationErrors = validateExpenseUpdate(data)
  if (validationErrors) {
    return error(validationErrors.join('; '), 400)
  }

  // Check user role — only inputer (or admin) can update
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can update expense entries', 403)
  }

  // Get existing entry
  const existingEntry = await getItem(TABLES.entries, { weekOf, entryId })
  if (!existingEntry) {
    return notFound('Expense entry')
  }

  // Per-item status check: only draft items can be edited by inputer
  const entryStatus = existingEntry.status || 'draft'
  if (entryStatus !== 'draft') {
    return error('Cannot edit entries that are not in draft status', 403)
  }

  // Build updated entry
  const now = new Date().toISOString()
  const updatedEntry = {
    ...existingEntry,
    updatedAt: now,
  }

  // Apply allowed field updates
  if (data.category !== undefined) updatedEntry.category = data.category
  if (data.item !== undefined) updatedEntry.item = data.item.trim()
  if (data.price !== undefined) updatedEntry.price = data.price
  if (data.purchased !== undefined) updatedEntry.purchased = data.purchased
  if (data.receiptKeys !== undefined) updatedEntry.receiptKeys = data.receiptKeys

  await putItem(TABLES.entries, updatedEntry)

  return success({ entry: updatedEntry })
}

// ─── DELETE /expenses/{weekOf}/{entryId} ─────────────────────────────────────

/**
 * Delete an expense entry.
 * Permission rules (per-item status):
 * - Inputer/admin can delete entries with status 'draft'
 * - Approver can delete entries with status 'submitted' (item removal with audit)
 * - Approved entries cannot be deleted by anyone
 */
async function deleteExpenseEntry(event, pathParams, queryParams) {
  const { weekOf, entryId } = pathParams || {}

  if (!weekOf || !entryId) {
    return error('Missing path parameters: weekOf and entryId required', 400)
  }

  if (!isValidWeekOf(weekOf)) {
    return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
  }

  // Get existing entry
  const existingEntry = await getItem(TABLES.entries, { weekOf, entryId })
  if (!existingEntry) {
    return notFound('Expense entry')
  }

  const entryStatus = existingEntry.status || 'draft'
  const userRole = event.user.role

  // Admin can delete any entry regardless of status
  if (userRole === 'admin') {
    await deleteItem(TABLES.entries, { weekOf, entryId })
    return success({ message: 'Entry deleted', entryId })
  }

  // Approved entries are locked for non-admins
  if (entryStatus === 'approved') {
    return error('Cannot delete approved entries', 403)
  }

  // Inputer can delete draft entries only
  if (userRole === 'inputer' && entryStatus === 'draft') {
    await deleteItem(TABLES.entries, { weekOf, entryId })
    return success({ message: 'Entry deleted', entryId })
  }

  // Approver can delete submitted entries (item removal with audit)
  if (userRole === 'approver' && entryStatus === 'submitted') {
    const reason = queryParams?.reason || ''
    await logRemoval(weekOf, existingEntry, event.user, reason)
    await deleteItem(TABLES.entries, { weekOf, entryId })
    return success({ message: 'Entry removed by approver', entryId })
  }

  return error('You do not have permission to delete this entry', 403)
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Log an approver removal in the week status record.
 */
async function logRemoval(weekOf, entry, approver, reason) {
  const removal = {
    entryId: entry.entryId,
    item: entry.item,
    category: entry.category,
    price: entry.price,
    removedBy: approver.userId,
    removedByName: approver.displayName,
    removedAt: new Date().toISOString(),
  }

  if (reason) {
    removal.reason = reason
  }

  // Get or create week status record to store removals
  let weekStatus = await getItem(TABLES.weekStatus, { weekOf })
  if (!weekStatus) {
    weekStatus = { weekOf, removals: [] }
  }

  const updatedWeekStatus = {
    ...weekStatus,
    removals: [...(weekStatus.removals || []), removal],
  }

  await putItem(TABLES.weekStatus, updatedWeekStatus)
}

/**
 * Safely parse JSON body, returning empty object on failure.
 */
function parseBody(body) {
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}
