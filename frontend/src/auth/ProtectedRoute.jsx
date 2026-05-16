import { useAuth } from './AuthContext'
import LoginPage from './LoginPage'
import PendingApproval from './PendingApproval'

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth()

  // Show loading spinner while checking auth state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-primary" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Authenticated but not approved — show pending screen
  if (user?.status !== 'approved') {
    return <PendingApproval />
  }

  // Authenticated and approved — render app
  return children
}
