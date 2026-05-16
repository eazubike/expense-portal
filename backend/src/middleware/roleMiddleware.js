/**
 * Role middleware — checks user role for protected endpoints.
 *
 * Role hierarchy:
 * - admin: can do everything
 * - approver: can approve/reject/revoke users
 * - inputer: cannot access user management endpoints (except /users/me)
 */

import { error } from '../utils/responses.js'

/**
 * Wraps a handler with role-based access control.
 * @param {Function} handler - The Lambda handler function
 * @param {string[]} allowedRoles - Array of roles that can access this endpoint
 */
export function withRole(handler, allowedRoles) {
  return async (event) => {
    const userRole = event.user?.role

    if (!userRole) {
      return error('Unauthorized. No role assigned.', 401)
    }

    // Admin can always access everything
    if (userRole === 'admin') {
      return handler(event)
    }

    if (!allowedRoles.includes(userRole)) {
      return error(`Forbidden. Required role: ${allowedRoles.join(' or ')}`, 403)
    }

    return handler(event)
  }
}

/**
 * Convenience wrapper: admin only access.
 */
export function adminOnly(handler) {
  return withRole(handler, ['admin'])
}

/**
 * Convenience wrapper: admin or approver access.
 */
export function approverOrAdmin(handler) {
  return withRole(handler, ['admin', 'approver'])
}
