import { useState } from 'react'
import ExpenseRow from './ExpenseRow'
import ConfirmDialog from '../common/ConfirmDialog'
import { formatCurrency } from '../../utils/formatters'

/**
 * Expense list — drafts at top (active), approved collapsed at bottom.
 */
export default function ExpenseList({
  expenses = [],
  isLoading,
  userRole = 'inputer',
  onTogglePurchased,
  onUpdatePrice,
  onUpdateEntry,
  onDelete,
  onBulkDelete,
  onRemove,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showBulkDelete, setShowBulkDelete] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [showApproved, setShowApproved] = useState(false)

  const isInputer = userRole === 'inputer' || userRole === 'admin'

  // Split by status
  const draftItems = expenses.filter(e => (e.status || 'draft') === 'draft')
  const submittedItems = expenses.filter(e => e.status === 'submitted')
  const approvedItems = expenses.filter(e => e.status === 'approved')

  const canBulkDelete = isInputer && draftItems.length > 1
  const approvedTotal = approvedItems.reduce((s, e) => s + (e.price || 0), 0)

  function handleDeleteRequest(entry) {
    setDeleteTarget(entry)
  }

  function handleDeleteConfirm() {
    if (deleteTarget) {
      onDelete(deleteTarget.weekOf, deleteTarget.entryId)
      setDeleteTarget(null)
    }
  }

  async function handleBulkDelete() {
    const toDelete = draftItems.map(e => ({ weekOf: e.weekOf, entryId: e.entryId }))
    setBulkDeleting(true)
    setShowBulkDelete(false)
    if (onBulkDelete) {
      await onBulkDelete(toDelete)
    }
    setBulkDeleting(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
      </div>
    )
  }

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="text-5xl mb-4" aria-hidden="true">📝</div>
        <h3 className="text-lg font-medium text-gray-900">No expenses yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Tap the + button below to add your first expense for this week.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Bulk delete bar for drafts */}
      {canBulkDelete && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="text-xs text-gray-500">{bulkDeleting ? 'Deleting...' : `${draftItems.length} draft items`}</span>
          {showBulkDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-600 font-medium">Delete all {draftItems.length} drafts?</span>
              <button type="button" onClick={handleBulkDelete} className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700">Yes</button>
              <button type="button" onClick={() => setShowBulkDelete(false)} className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300">No</button>
            </div>
          ) : (
            <button type="button" onClick={() => setShowBulkDelete(true)} className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100">
              Delete All Drafts
            </button>
          )}
        </div>
      )}

      {/* Draft items — full interactive */}
      {draftItems.length > 0 && (
        <div className="divide-y divide-gray-100">
          {draftItems.map((entry) => (
            <ExpenseRow
              key={entry.entryId}
              entry={entry}
              userRole={userRole}
              onTogglePurchased={onTogglePurchased}
              onUpdatePrice={onUpdatePrice}
              onUpdateEntry={onUpdateEntry}
              onDelete={handleDeleteRequest}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {/* Submitted items — visible but not editable */}
      {submittedItems.length > 0 && (
        <div className="divide-y divide-gray-100">
          {submittedItems.map((entry) => (
            <ExpenseRow
              key={entry.entryId}
              entry={entry}
              userRole={userRole}
              onTogglePurchased={onTogglePurchased}
              onUpdatePrice={onUpdatePrice}
              onUpdateEntry={onUpdateEntry}
              onDelete={handleDeleteRequest}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}

      {/* Approved items — collapsed by default */}
      {approvedItems.length > 0 && (
        <div className="border-t border-gray-200">
          <button
            type="button"
            onClick={() => setShowApproved(!showApproved)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 text-left"
          >
            <span className="text-xs font-medium text-green-700">
              ✓ Approved ({approvedItems.length} items · {formatCurrency(approvedTotal)})
            </span>
            <span className="text-xs text-gray-400">{showApproved ? '▾' : '▸'}</span>
          </button>
          {showApproved && (
            <div className="divide-y divide-gray-100 opacity-60">
              {approvedItems.map((entry) => (
                <ExpenseRow
                  key={entry.entryId}
                  entry={entry}
                  userRole={userRole}
                  onTogglePurchased={onTogglePurchased}
                  onUpdatePrice={onUpdatePrice}
                  onUpdateEntry={onUpdateEntry}
                  onDelete={handleDeleteRequest}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Expense"
        message={deleteTarget ? `Remove "${deleteTarget.item}" (₦${deleteTarget.price?.toLocaleString()}) from this week?` : ''}
        confirmLabel="Delete"
        cancelLabel="Keep"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
