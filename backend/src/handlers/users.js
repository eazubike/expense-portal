/**
 * Users Lambda handler.
 * Manages user registration, approval, role assignment, and revocation.
 *
 * Routes:
 *   GET  /users/me              — Get current user profile (auto-registers if new)
 *   GET  /users                 — List all users (admin/approver only)
 *   POST /users/{userId}/approve — Approve a pending user (admin only)
 *   POST /users/{userId}/reject  — Reject a pending user (admin only)
 *   PUT  /users/{userId}/role    — Change user's role (admin only)
 *   POST /users/{userId}/revoke  — Revoke a user's access (admin only)
 */

import { withAuth } from '../middleware/authMiddleware.js'
import { withRole } from '../middleware/roleMiddleware.js'
import { getItem, putItem, deleteItem, scanTable, TABLES } from '../services/dynamodb.js'
import { success, error, notFound } from '../utils/responses.js'

const VALID_ROLES = ['inputer', 'approver', 'admin']
const VALID_STATUSES = ['awaiting_approval', 'approved', 'rejected', 'revoked']

/**
 * Main Lambda handler — routes based on HTTP method and path.
 */
export const handler = withAuth(async (event) => {
  const { httpMethod, pathParameters, path } = event
  const resource = event.resource || ''

  try {
    // Route: GET /users/me
    if (httpMethod === 'GET' && isGetMeRoute(resource, path)) {
      return getCurrentUser(event)
    }

    // Route: GET /users (list all)
    if (httpMethod === 'GET' && isListUsersRoute(resource, path, pathParameters)) {
      return await withRole(listUsers, ['admin', 'approver'])(event)
    }

    // Routes that require a userId path parameter
    const userId = pathParameters?.userId
    if (!userId) {
      return error('Missing userId parameter', 400)
    }

    // Route: POST /users/{userId}/approve
    if (httpMethod === 'POST' && resource.endsWith('/approve')) {
      return await withRole(approveUser, ['admin'])(event)
    }

    // Route: POST /users/{userId}/reject
    if (httpMethod === 'POST' && resource.endsWith('/reject')) {
      return await withRole(rejectUser, ['admin'])(event)
    }

    // Route: PUT /users/{userId}/role
    if (httpMethod === 'PUT' && resource.endsWith('/role')) {
      return await withRole(updateUserRole, ['admin'])(event)
    }

    // Route: POST /users/{userId}/revoke
    if (httpMethod === 'POST' && resource.endsWith('/revoke')) {
      return await withRole(revokeUser, ['admin'])(event)
    }

    // Route: DELETE /users/{userId}
    if (httpMethod === 'DELETE') {
      return await withRole(deleteUserHandler, ['admin'])(event)
    }

    return error(`Unsupported route: ${httpMethod} ${resource}`, 405)
  } catch (err) {
    console.error('Users handler error:', err)
    return error('Internal server error', 500)
  }
})

// ─── Route Helpers ───────────────────────────────────────────────────────────

function isGetMeRoute(resource, path) {
  return resource === '/users/me' || (path || '').endsWith('/users/me')
}

function isListUsersRoute(resource, path, pathParameters) {
  // GET /users with no path parameters (not /users/{userId})
  if (resource === '/users') return true
  if ((path || '').endsWith('/users') && !pathParameters?.userId) return true
  return false
}

// ─── Handler Functions ───────────────────────────────────────────────────────

/**
 * GET /users/me — Returns the current user's profile.
 * The auth middleware handles auto-registration, so by this point
 * the user always exists in the DB.
 */
function getCurrentUser(event) {
  const user = event.user
  return success({ user })
}

/**
 * GET /users — List all users (admin/approver only).
 * Returns all users with their current status and role.
 */
async function listUsers(event) {
  const users = await scanTable(TABLES.users)

  // Sort by createdAt descending (newest first)
  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return success({ users })
}

/**
 * POST /users/{userId}/approve — Approve a pending user.
 * Request body should contain { role: 'inputer' | 'approver' | 'admin' }
 */
async function approveUser(event) {
  const { userId } = event.pathParameters
  const body = parseBody(event.body)
  const role = body.role || 'inputer'

  if (!VALID_ROLES.includes(role)) {
    return error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`, 400)
  }

  const targetUser = await getItem(TABLES.users, { userId })
  if (!targetUser) {
    return notFound('User')
  }

  if (targetUser.status !== 'awaiting_approval' && targetUser.status !== 'revoked' && targetUser.status !== 'rejected') {
    return error(`Cannot approve user with status: ${targetUser.status}.`, 400)
  }

  const now = new Date().toISOString()
  const updatedUser = {
    ...targetUser,
    status: 'approved',
    role,
    approvedBy: event.user.userId,
    approvedAt: now,
  }

  await putItem(TABLES.users, updatedUser)

  return success({ user: updatedUser, message: `User ${targetUser.displayName} approved with role: ${role}` })
}

/**
 * POST /users/{userId}/reject — Reject a pending user.
 */
async function rejectUser(event) {
  const { userId } = event.pathParameters

  const targetUser = await getItem(TABLES.users, { userId })
  if (!targetUser) {
    return notFound('User')
  }

  if (targetUser.status !== 'awaiting_approval') {
    return error(`Cannot reject user with status: ${targetUser.status}. User must be in 'awaiting_approval' status.`, 400)
  }

  const updatedUser = {
    ...targetUser,
    status: 'rejected',
  }

  await putItem(TABLES.users, updatedUser)

  return success({ user: updatedUser, message: `User ${targetUser.displayName} has been rejected` })
}

/**
 * PUT /users/{userId}/role — Change a user's role.
 * Request body: { role: 'inputer' | 'approver' | 'admin' }
 */
async function updateUserRole(event) {
  const { userId } = event.pathParameters
  const body = parseBody(event.body)
  const { role } = body

  if (!role) {
    return error('Missing required field: role', 400)
  }

  if (!VALID_ROLES.includes(role)) {
    return error(`Invalid role: ${role}. Must be one of: ${VALID_ROLES.join(', ')}`, 400)
  }

  const targetUser = await getItem(TABLES.users, { userId })
  if (!targetUser) {
    return notFound('User')
  }

  // Cannot change role of non-approved users
  if (targetUser.status !== 'approved') {
    return error(`Cannot change role for user with status: ${targetUser.status}. User must be approved.`, 400)
  }

  // Prevent admin from changing their own role (safety check)
  if (userId === event.user.userId) {
    return error('Cannot change your own role', 400)
  }

  const updatedUser = {
    ...targetUser,
    role,
  }

  await putItem(TABLES.users, updatedUser)

  return success({ user: updatedUser, message: `User ${targetUser.displayName} role changed to: ${role}` })
}

/**
 * POST /users/{userId}/revoke — Revoke a user's access.
 */
async function revokeUser(event) {
  const { userId } = event.pathParameters

  const targetUser = await getItem(TABLES.users, { userId })
  if (!targetUser) {
    return notFound('User')
  }

  // Cannot revoke yourself
  if (userId === event.user.userId) {
    return error('Cannot revoke your own access', 400)
  }

  // Cannot revoke already revoked users
  if (targetUser.status === 'revoked') {
    return error('User access is already revoked', 400)
  }

  const updatedUser = {
    ...targetUser,
    status: 'revoked',
  }

  await putItem(TABLES.users, updatedUser)

  return success({ user: updatedUser, message: `User ${targetUser.displayName} access has been revoked` })
}

/**
 * DELETE /users/{userId} — Permanently delete a user.
 */
async function deleteUserHandler(event) {
  const { userId } = event.pathParameters

  const targetUser = await getItem(TABLES.users, { userId })
  if (!targetUser) {
    return notFound('User')
  }

  // Cannot delete yourself
  if (userId === event.user.userId) {
    return error('Cannot delete your own account', 400)
  }

  await deleteItem(TABLES.users, { userId })

  return success({ message: `User ${targetUser.displayName} has been deleted` })
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function parseBody(body) {
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}
