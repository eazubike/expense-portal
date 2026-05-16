import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { setTokenGetter } from '../api/client'
import { getCurrentUser } from '../api/users'

const AuthContext = createContext(null)

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI

/**
 * Exchange an authorization code for tokens via Cognito's token endpoint.
 */
async function exchangeCodeForTokens(code) {
  const tokenUrl = `https://${COGNITO_DOMAIN}/oauth2/token`

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  return response.json()
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const tokensRef = useRef(null)

  // Wire up the API client token getter
  useEffect(() => {
    setTokenGetter(() => tokensRef.current?.id_token ?? null)
  }, [])

  // Listen for 401 events from the API client
  useEffect(() => {
    function handleUnauthorized() {
      tokensRef.current = null
      setUser(null)
      setIsAuthenticated(false)
    }
    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  /**
   * After obtaining tokens, fetch the user profile from the API.
   */
  const loadUserProfile = useCallback(async () => {
    try {
      const profile = await getCurrentUser()
      setUser(profile)
      setIsAuthenticated(true)
    } catch (err) {
      // If /users/me fails (e.g. user not yet created), clear auth state
      console.error('Failed to load user profile:', err)
      tokensRef.current = null
      setUser(null)
      setIsAuthenticated(false)
    }
  }, [])

  /**
   * On mount: check for authorization code in URL params (OAuth callback),
   * or try to use existing tokens if available.
   */
  useEffect(() => {
    async function init() {
      setIsLoading(true)

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (code) {
        // Remove code from URL to prevent re-use on refresh
        window.history.replaceState({}, '', window.location.pathname)

        try {
          const tokens = await exchangeCodeForTokens(code)
          tokensRef.current = tokens
          await loadUserProfile()
        } catch (err) {
          console.error('OAuth callback error:', err)
        }
      }

      setIsLoading(false)
    }

    init()
  }, [loadUserProfile])

  /**
   * Redirect to Cognito Hosted UI (which redirects to Google).
   */
  const signIn = useCallback(() => {
    const authorizeUrl = new URL(`https://${COGNITO_DOMAIN}/oauth2/authorize`)
    authorizeUrl.searchParams.set('client_id', CLIENT_ID)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('scope', 'openid email profile')
    authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI)
    authorizeUrl.searchParams.set('identity_provider', 'Google')

    window.location.href = authorizeUrl.toString()
  }, [])

  /**
   * Clear tokens and redirect to Cognito logout.
   */
  const signOut = useCallback(() => {
    tokensRef.current = null
    setUser(null)
    setIsAuthenticated(false)

    const logoutUrl = new URL(`https://${COGNITO_DOMAIN}/logout`)
    logoutUrl.searchParams.set('client_id', CLIENT_ID)
    logoutUrl.searchParams.set('logout_uri', REDIRECT_URI)

    window.location.href = logoutUrl.toString()
  }, [])

  const value = {
    user,
    isAuthenticated,
    isLoading,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
