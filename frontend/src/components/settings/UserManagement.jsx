import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAllUsers, approveUser, rejectUser, updateUserRole, revokeUser, deleteUser } from '../../api/users'

function UserAvatar({ user }) {
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.displayName}
        className="h-10 w-10 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }
  const initials = (user.displayName || user.email || '?')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
      {initials}
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    awaiting_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    revoked: 'bg-gray-100 text-gray-800',
  }
  const labels = {
    awaiting_approval: 'Pending',
    approved: 'Active',
    rejected: 'Rejected',
    revoked: 'Disabled',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status] || status}
    </span>
  )
}

/**
 * Confirmation dialog for access control actions.
 */
function ConfirmAction({ message, onConfirm, onCancel, isLoading, variant = 'danger' }) {
  const btnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-green-600 hover:bg-green-700 text-white'

  return (
    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
      <p className="text-sm font-medium text-yellow-800">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors ${btnClass}`}
        >
          {isLoading ? 'Processing...' : 'Yes, proceed'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function PendingUserCard({ user, onApprove, onReject, isActioning }) {
  const [confirm, setConfirm] = useState(null) // 'approve' | 'reject'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>
      </div>

      {confirm ? (
        <ConfirmAction
          message={confirm === 'approve' ? `Approve ${user.displayName}?` : `Reject ${user.displayName}? They won't be able to access the app.`}
          variant={confirm === 'approve' ? 'success' : 'danger'}
          onConfirm={() => { confirm === 'approve' ? onApprove(user.userId) : onReject(user.userId); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
          isLoading={isActioning}
        />
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirm('approve')}
            disabled={isActioning}
            type="button"
            className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => setConfirm('reject')}
            disabled={isActioning}
            type="button"
            className="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

function ApprovedUserCard({ user, onRoleChange, onDisable, onDelete, isActioning }) {
  const [confirm, setConfirm] = useState(null) // 'disable' | 'delete' | 'role'
  const [pendingRole, setPendingRole] = useState(null)

  function handleRoleChange(e) {
    const newRole = e.target.value
    if (newRole !== user.role) {
      setPendingRole(newRole)
      setConfirm('role')
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <StatusBadge status={user.status} />
        </div>
      </div>

      {confirm ? (
        <ConfirmAction
          message={
            confirm === 'disable' ? `Disable ${user.displayName}? They will lose access until re-enabled.` :
            confirm === 'delete' ? `Permanently delete ${user.displayName}? This cannot be undone.` :
            `Change ${user.displayName}'s role to ${pendingRole}?`
          }
          variant={confirm === 'delete' ? 'danger' : confirm === 'disable' ? 'danger' : 'success'}
          onConfirm={() => {
            if (confirm === 'disable') onDisable(user.userId)
            if (confirm === 'delete') onDelete(user.userId)
            if (confirm === 'role') onRoleChange(user.userId, pendingRole)
            setConfirm(null)
            setPendingRole(null)
          }}
          onCancel={() => { setConfirm(null); setPendingRole(null) }}
          isLoading={isActioning}
        />
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={user.role}
            onChange={handleRoleChange}
            disabled={isActioning}
            className="flex-1 rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:opacity-50"
            aria-label={`Role for ${user.displayName}`}
          >
            <option value="inputer">Inputer</option>
            <option value="approver">Approver</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={() => setConfirm('disable')}
            disabled={isActioning}
            type="button"
            className="rounded-md border border-orange-300 px-3 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 disabled:opacity-50 transition-colors"
          >
            Disable
          </button>
          <button
            onClick={() => setConfirm('delete')}
            disabled={isActioning}
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

function DisabledUserCard({ user, onEnable, onDelete, isActioning }) {
  const [confirm, setConfirm] = useState(null) // 'enable' | 'delete'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900 truncate">{user.displayName}</p>
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
          <StatusBadge status={user.status} />
        </div>
      </div>

      {confirm ? (
        <ConfirmAction
          message={
            confirm === 'enable' ? `Re-enable ${user.displayName}? They will regain access.` :
            `Permanently delete ${user.displayName}? This cannot be undone.`
          }
          variant={confirm === 'enable' ? 'success' : 'danger'}
          onConfirm={() => { confirm === 'enable' ? onEnable(user.userId) : onDelete(user.userId); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
          isLoading={isActioning}
        />
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirm('enable')}
            disabled={isActioning}
            type="button"
            className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            Enable
          </button>
          <button
            onClick={() => setConfirm('delete')}
            disabled={isActioning}
            type="button"
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

export default function UserManagement() {
  const queryClient = useQueryClient()

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: getAllUsers,
  })

  const approveMutation = useMutation({
    mutationFn: approveUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const rejectMutation = useMutation({
    mutationFn: rejectUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }) => updateUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const revokeMutation = useMutation({
    mutationFn: revokeUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const isActioning =
    approveMutation.isPending ||
    rejectMutation.isPending ||
    roleMutation.isPending ||
    revokeMutation.isPending ||
    deleteMutation.isPending

  const pendingUsers = users.filter((u) => u.status === 'awaiting_approval')
  const approvedUsers = users.filter((u) => u.status === 'approved')
  const disabledUsers = users.filter((u) => u.status === 'revoked' || u.status === 'rejected')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-green-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Failed to load users. Please try again.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">User Management</h2>
        <p className="text-sm text-gray-500">Manage user access and roles</p>
      </div>

      {/* Pending users */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Pending Approval ({pendingUsers.length})
        </h3>
        {pendingUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No pending users.</p>
        ) : (
          <div className="space-y-3">
            {pendingUsers.map((user) => (
              <PendingUserCard
                key={user.userId}
                user={user}
                onApprove={(id) => approveMutation.mutate(id)}
                onReject={(id) => rejectMutation.mutate(id)}
                isActioning={isActioning}
              />
            ))}
          </div>
        )}
      </section>

      {/* Active users */}
      <section>
        <h3 className="mb-3 text-sm font-medium text-gray-700">
          Active Users ({approvedUsers.length})
        </h3>
        {approvedUsers.length === 0 ? (
          <p className="text-sm text-gray-500">No active users.</p>
        ) : (
          <div className="space-y-3">
            {approvedUsers.map((user) => (
              <ApprovedUserCard
                key={user.userId}
                user={user}
                onRoleChange={(id, role) => roleMutation.mutate({ userId: id, role })}
                onDisable={(id) => revokeMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                isActioning={isActioning}
              />
            ))}
          </div>
        )}
      </section>

      {/* Disabled users */}
      {disabledUsers.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Disabled ({disabledUsers.length})
          </h3>
          <div className="space-y-3">
            {disabledUsers.map((user) => (
              <DisabledUserCard
                key={user.userId}
                user={user}
                onEnable={(id) => approveMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
                isActioning={isActioning}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
