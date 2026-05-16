/**
 * Week status Lambda handler.
 * Manages per-item approval workflow state transitions.
 *
 * Routes:
 *   GET    /weeks                      — List all weeks with computed status
 *   GET    /weeks/{weekOf}             — Get single week with computed status
 *   POST   /weeks/{weekOf}/submit      — Change all draft entries → submitted
 *   POST   /weeks/{weekOf}/approve     — Change all submitted entries → approved
 *   POST   /weeks/{weekOf}/reject      — Change all submitted entries → draft
 *   GET    /weeks/{weekOf}/removals    — Get removal audit trail
 */

import { withAuth } from '../middleware/authMiddleware.js'
import { getItem, putItem, queryItems, scanTable, TABLES } from '../services/dynamodb.js'
import { success, error, notFound } from '../utils/responses.js'
import { isValidWeekOf } from '../utils/validators.js'

/**
 * Main Lambda handler — routes based on HTTP method and path.
 */
export const handler = withAuth(async (event) => {
  const { httpMethod, pathParameters, body, resource, path } = event

  try {
    // Determine the action from the path
    const action = extractAction(resource || path || '')

    switch (httpMethod) {
      case 'GET':
        if (action === 'removals') {
          return await getRemovalAuditTrail(pathParameters)
        }
        return await getWeeks(pathParameters)
      case 'POST':
        return await handleWeekAction(event, pathParameters, action)
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Weeks handler error:', err)
    return error('Internal server error', 500)
  }
})

// ─── GET /weeks or GET /weeks/{weekOf} ───────────────────────────────────────

/**
 * Get all weeks or a single week with computed status from entries.
 */
async function getWeeks(pathParams) {
  const weekOf = pathParams?.weekOf

  // Single week
  if (weekOf) {
    if (!isValidWeekOf(weekOf)) {
      return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
    }

    const weekData = await computeWeekStatus(weekOf)
    return success({ week: weekData })
  }

  // All weeks — scan entries and compute status per week
  const allEntries = await scanTable(TABLES.entries)

  // Group entries by weekOf
  const weekMap = {}
  for (const entry of allEntries) {
    if (!weekMap[entry.weekOf]) {
      weekMap[entry.weekOf] = []
    }
    weekMap[entry.weekOf].push(entry)
  }

  // Compute status for each week
  const weeks = Object.entries(weekMap).map(([wk, entries]) => {
    return computeWeekStatusFromEntries(wk, entries)
  })

  // Sort by weekOf descending (most recent first)
  weeks.sort((a, b) => b.weekOf.localeCompare(a.weekOf))

  return success({ weeks })
}

// ─── GET /weeks/{weekOf}/removals ────────────────────────────────────────────

/**
 * Get the removal audit trail for a specific week.
 */
async function getRemovalAuditTrail(pathParams) {
  const weekOf = pathParams?.weekOf

  if (!weekOf) {
    return error('Missing weekOf path parameter', 400)
  }

  if (!isValidWeekOf(weekOf)) {
    return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
  }

  const weekStatus = await getItem(TABLES.weekStatus, { weekOf })
  const removals = weekStatus?.removals || []

  return success({ weekOf, removals })
}

// ─── POST /weeks/{weekOf}/{action} ──────────────────────────────────────────

/**
 * Handle per-item status transitions.
 */
async function handleWeekAction(event, pathParams, action) {
  const weekOf = pathParams?.weekOf

  if (!weekOf) {
    return error('Missing weekOf path parameter', 400)
  }

  if (!isValidWeekOf(weekOf)) {
    return error('weekOf must be a valid Sunday date in YYYY-MM-DD format', 400)
  }

  // Validate action
  if (!['submit', 'approve', 'reject'].includes(action)) {
    return error(`Invalid action: ${action}`, 400)
  }

  // Check role permissions
  const userRole = event.user.role

  if (action === 'submit' && userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can submit entries', 403)
  }

  if ((action === 'approve' || action === 'reject') && userRole !== 'approver' && userRole !== 'admin') {
    return error(`Only approvers can perform the "${action}" action`, 403)
  }

  // Get all entries for this week
  const entries = await queryItems(
    TABLES.entries,
    'weekOf = :weekOf',
    { ':weekOf': weekOf }
  )

  const now = new Date().toISOString()

  switch (action) {
    case 'submit':
      return await handleSubmit(weekOf, entries, event.user, now)
    case 'approve':
      return await handleApprove(weekOf, entries, event.user, now)
    case 'reject':
      return await handleReject(weekOf, entries, event.user, now)
    default:
      return error(`Invalid action: ${action}`, 400)
  }
}

// ─── Action Handlers ─────────────────────────────────────────────────────────

/**
 * Submit: change all draft entries to submitted.
 * Returns the count of submitted items.
 */
async function handleSubmit(weekOf, entries, user, now) {
  const draftEntries = entries.filter((e) => (e.status || 'draft') === 'draft')

  if (draftEntries.length === 0) {
    return error('No draft entries to submit', 400)
  }

  for (const entry of draftEntries) {
    const updatedEntry = {
      ...entry,
      status: 'submitted',
      updatedAt: now,
    }
    await putItem(TABLES.entries, updatedEntry)
  }

  return success({
    message: `Submitted ${draftEntries.length} items for approval`,
    count: draftEntries.length,
    weekOf,
  })
}

/**
 * Approve: change all submitted entries to approved.
 * Returns the count of approved items.
 */
async function handleApprove(weekOf, entries, user, now) {
  const submittedEntries = entries.filter((e) => e.status === 'submitted')

  if (submittedEntries.length === 0) {
    return error('No submitted entries to approve', 400)
  }

  for (const entry of submittedEntries) {
    const updatedEntry = {
      ...entry,
      status: 'approved',
      purchased: true,
      updatedAt: now,
    }
    await putItem(TABLES.entries, updatedEntry)
  }

  return success({
    message: `Approved ${submittedEntries.length} items`,
    count: submittedEntries.length,
    weekOf,
  })
}

/**
 * Reject: change all submitted entries back to draft.
 * Returns the count of rejected items.
 */
async function handleReject(weekOf, entries, user, now) {
  const submittedEntries = entries.filter((e) => e.status === 'submitted')

  if (submittedEntries.length === 0) {
    return error('No submitted entries to reject', 400)
  }

  for (const entry of submittedEntries) {
    const updatedEntry = {
      ...entry,
      status: 'draft',
      updatedAt: now,
    }
    await putItem(TABLES.entries, updatedEntry)
  }

  return success({
    message: `Returned ${submittedEntries.length} items to draft`,
    count: submittedEntries.length,
    weekOf,
  })
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Compute week status from entries for a given weekOf.
 */
async function computeWeekStatus(weekOf) {
  const entries = await queryItems(
    TABLES.entries,
    'weekOf = :weekOf',
    { ':weekOf': weekOf }
  )

  return computeWeekStatusFromEntries(weekOf, entries)
}

/**
 * Compute week status summary from a list of entries.
 * 
 * Status logic:
 * - Entries with status 'draft' (or no status field) from non-import sources → draft
 * - Entries with status 'submitted' → submitted
 * - Entries with status 'approved' → approved
 * - Imported entries (createdBy === 'import') with no explicit status → approved
 */
function computeWeekStatusFromEntries(weekOf, entries) {
  const draftCount = entries.filter((e) => {
    const status = e.status
    if (!status) {
      // No status field: treat imported data as approved, others as draft
      return e.createdBy !== 'import'
    }
    return status === 'draft'
  }).length

  const submittedCount = entries.filter((e) => e.status === 'submitted').length

  const approvedCount = entries.filter((e) => {
    if (e.status === 'approved') return true
    // Imported entries without explicit status are considered approved
    if (!e.status && e.createdBy === 'import') return true
    return false
  }).length

  const totalItems = entries.length
  const totalSpent = entries.reduce((sum, e) => sum + (e.price || 0), 0)

  return {
    weekOf,
    totalItems,
    totalSpent,
    draftCount,
    submittedCount,
    approvedCount,
  }
}

/**
 * Extract the action from the resource path.
 * e.g. /weeks/{weekOf}/submit → 'submit'
 * e.g. /weeks/{weekOf}/removals → 'removals'
 * e.g. /weeks/{weekOf} → null
 * e.g. /weeks → null
 */
function extractAction(resourcePath) {
  const parts = resourcePath.split('/').filter(Boolean)
  // Pattern: weeks/{weekOf}/{action}
  if (parts.length >= 3) {
    const action = parts[parts.length - 1]
    // Exclude path parameter placeholders
    if (action.startsWith('{')) return null
    return action
  }
  return null
}
