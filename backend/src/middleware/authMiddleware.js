/**
 * Auth middleware — validates JWT and checks user approval status.
 * Extracts user info from Cognito authorizer claims, looks up user in DynamoDB,
 * and handles auto-registration for GET /users/me requests.
 */

import { getItem, putItem, TABLES } from '../services/dynamodb.js'
import { error } from '../utils/responses.js'

/**
 * Extract user info from the API Gateway event (Cognito authorizer).
 * The Cognito authorizer populates event.requestContext.authorizer.claims.
 */
function extractUserFromClaims(event) {
  const claims = event.requestContext?.authorizer?.claims
  if (!claims) {
    return null
  }

  return {
    userId: claims.sub,
    email: claims.email,
    displayName: claims.name || claims['cognito:username'] || claims.email,
    avatarUrl: claims.picture || null,
  }
}

/**
 * Check if the current request is GET /users/me.
 */
function isGetCurrentUserRequest(event) {
  const method = event.httpMethod
  const resource = event.resource || ''
  const path = event.path || ''

  return method === 'GET' && (resource === '/users/me' || path.endsWith('/users/me'))
}

/**
 * Wraps a handler with authentication and approval checks.
 *
 * Behavior:
 * - Extracts user from JWT claims (via API Gateway Cognito authorizer)
 * - Looks up user in DynamoDB Users table
 * - If user not found and request is GET /users/me, auto-creates with status 'awaiting_approval'
 * - If user not found for other requests, returns 403
 * - If user found but status is not 'approved', returns 403 (except GET /users/me)
 * - Attaches full user object to event.user for downstream handlers
 */
export function withAuth(handler) {
  return async (event) => {
    const claimsUser = extractUserFromClaims(event)
    if (!claimsUser) {
      return error('Unauthorized', 401)
    }

    const isGetMe = isGetCurrentUserRequest(event)

    // Look up user in DynamoDB
    let dbUser = await getItem(TABLES.users, { userId: claimsUser.userId })

    if (!dbUser) {
      // User not found in DB
      if (isGetMe) {
        // Auto-register new user with awaiting_approval status
        const now = new Date().toISOString()
        dbUser = {
          userId: claimsUser.userId,
          email: claimsUser.email,
          displayName: claimsUser.displayName,
          avatarUrl: claimsUser.avatarUrl,
          role: 'inputer',
          status: 'awaiting_approval',
          createdAt: now,
          lastLoginAt: now,
        }
        await putItem(TABLES.users, dbUser)
      } else {
        return error('User not found. Please register first.', 403)
      }
    }

    // For GET /users/me, always allow access regardless of status
    if (!isGetMe && dbUser.status !== 'approved') {
      return error(`Access denied. Account status: ${dbUser.status}`, 403)
    }

    // Update lastLoginAt (fire and forget for performance)
    if (dbUser.lastLoginAt) {
      const lastLogin = new Date(dbUser.lastLoginAt)
      const now = new Date()
      // Only update if last login was more than 5 minutes ago to reduce writes
      if (now - lastLogin > 5 * 60 * 1000) {
        dbUser.lastLoginAt = now.toISOString()
        putItem(TABLES.users, dbUser).catch(() => {})
      }
    }

    // Attach full user info to event for downstream handlers
    event.user = {
      userId: dbUser.userId,
      email: dbUser.email,
      displayName: dbUser.displayName,
      avatarUrl: dbUser.avatarUrl,
      role: dbUser.role,
      status: dbUser.status,
    }

    return handler(event)
  }
}
