/**
 * Approval status banner with confirmation dialogs for major actions.
 */
import { useState } from 'react'
import { buildSubmissionMessage, shareToWhatsApp } from '../../utils/whatsappShare'
import { formatWeekDate } from '../../utils/dateUtils'

export default function ApprovalBanner({
  weekOf,
  weekStart,
  expenses = [],
  weeklyTotal = 0,
  userRole = 'inputer',
  userName = '',
  onSubmit,
  onApprove,
  onReject,
  isLoading = false,
}) {
  const [confirmAction, setConfirmAction] = useState(null)

  const draftCount = expenses.filter((e) => (e.status || 'draft') === 'draft').length
  const submittedCount = expenses.filter((e) => e.status === 'submitted').length
  const approvedCount = expenses.filter((e) => e.status === 'approved').length

  if (expenses.length === 0) return null

  function handleWhatsAppShare() {
    const weekDate = formatWeekDate(weekStart)
    const appUrl = window.location.origin

    // Use appropriate message based on status
    if (approvedCount > 0 && draftCount === 0 && submittedCount === 0) {
      // All approved
      let message = `📋 *Expense for week of ${weekDate}*\n\n`
      message += `*Total: ₦${weeklyTotal.toLocaleString()} (${expenses.length} items)*\n\n`
      message += `✅ All items approved\n\n`
      message += `👉 View: ${appUrl}`
      shareToWhatsApp(message)
    } else {
      const message = buildSubmissionMessage(weekDate, weeklyTotal, expenses, appUrl)
      shareToWhatsApp(message)
    }
  }

  function handleConfirmedAction() {
    if (confirmAction === 'submit') onSubmit()
    if (confirmAction === 'approve') onApprove()
    if (confirmAction === 'reject') onReject()
    setConfirmAction(null)
  }

  return (
    <div className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-lg mx-auto space-y-3">
        {/* Status summary */}
        <div className="flex items-center gap-2 flex-wrap">
          {draftCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              {draftCount} draft
            </span>
          )}
          {submittedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
              <span className="w-2 h-2 rounded-full bg-orange-400" />
              {submittedCount} submitted
            </span>
          )}
          {approvedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              {approvedCount} approved
            </span>
          )}
        </div>

        {/* Confirmation dialog */}
        {confirmAction && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
            <p className="text-sm font-medium text-yellow-800">
              {confirmAction === 'submit' && `Submit ${draftCount} item${draftCount !== 1 ? 's' : ''} for approval?`}
              {confirmAction === 'approve' && `Approve ${submittedCount} item${submittedCount !== 1 ? 's' : ''}?`}
              {confirmAction === 'reject' && `Return ${submittedCount} item${submittedCount !== 1 ? 's' : ''} to draft?`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmedAction}
                disabled={isLoading}
                className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Processing...' : 'Yes, proceed'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons (hidden when confirmation is showing) */}
        {!confirmAction && (
          <>
            {/* Submit button — inputer only */}
            {draftCount > 0 && userRole === 'inputer' && (
              <button
                type="button"
                onClick={() => setConfirmAction('submit')}
                disabled={isLoading}
                className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                Submit {draftCount} item{draftCount !== 1 ? 's' : ''} for approval
              </button>
            )}

            {/* WhatsApp share — after submission */}
            {(submittedCount > 0 || (approvedCount > 0 && draftCount === 0)) && (
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full px-4 py-2.5 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 active:bg-green-200 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Share on WhatsApp
              </button>
            )}

            {/* Approve + Request Changes — approver/admin */}
            {submittedCount > 0 && (userRole === 'approver' || userRole === 'admin') && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction('approve')}
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  ✅ Approve {submittedCount}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('reject')}
                  disabled={isLoading}
                  className="px-4 py-2.5 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 active:bg-orange-200 disabled:opacity-50 transition-colors"
                >
                  ↩ Request Changes
                </button>
              </div>
            )}

            {/* All approved */}
            {expenses.length > 0 && approvedCount === expenses.length && (
              <p className="text-xs text-green-600 font-medium text-center">
                ✓ All items approved
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
