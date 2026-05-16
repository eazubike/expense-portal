/**
 * Auth helpers for token validation and user extraction.
 */

/**
 * Extract user info from the API Gateway event (Cognito authorizer).
 * The Cognito authorizer populates event.requestContext.authorizer.claims.
 */
export function extractUser(event) {
  const claims = event.requestContext?.authorizer?.claims
  if (!claims) {
    return null
  }

  return {
    userId: claims.sub,
    email: claims.email,
    displayName: claims.name || claims.email,
  }
}

/**
 * Check if the event has a valid authenticated user.
 */
export function isAuthenticated(event) {
  return extractUser(event) !== null
}
