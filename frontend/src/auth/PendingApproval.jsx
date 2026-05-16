import { useAuth } from './AuthContext'

export default function PendingApproval() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {/* Status icon */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
        </div>

        {/* Message */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Account Pending Approval</h2>
          <p className="mt-2 text-gray-600">
            Your account is pending admin approval. You&apos;ll be notified when approved.
          </p>
        </div>

        {/* User info */}
        {user && (
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
            <p className="font-medium text-gray-900">{user.displayName}</p>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          type="button"
          className="inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
