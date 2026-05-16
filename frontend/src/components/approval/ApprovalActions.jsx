import { useState } from 'react'
import { buildApprovalMessage, shareToWhatsApp } from '../../utils/whatsappShare'
import { formatWeekDate } from '../../utils/dateUtils'

/**
 * Approver action buttons: Approve / Request Changes / Mark as Paid.
 * Only shown when user role is "approver" and week is in appropriate status.
 */
export default function ApprovalActions({
  weekOf,
  weekStart,
  weekStatus,
  weeklyTotal = 0,
  approverName = '',
  onApprove,
  onReject,
  onMarkPaid,
  isLoading = false,
}) {
  const [confirmAction, setConfirmAction] = useState(null)
  const status = weekStatus?.status || 'draft'

  async function handleApprove() {
    setConfirmAction(null)
    try {
      await onApprove()
      // Share approval message via WhatsApp
      const weekDate = formatWeekDate(weekStart)
      const message = buildApprovalMessage(weekDate, weeklyTotal, approverName)
      shareToWhatsApp(message)
    } catch (err) {
      console.error('Approve failed:', err)
    }
  }

  async function handleReject() {
    setConfirmAction(null)
    try {
      await onReject()
    } catch (err) {
      console.error('Reject failed:', err)
    }
  }

  async function handleMarkPaid() {
    setConfirmAction(null)
    try {
      await onMarkPaid()
    } catch (err) {
      console.error('Mark paid failed:', err)
    }
  }

  // Confirmation dialog
  if (confirmAction) {
    const labels = {
      approve: { text: 'Approve this week?', btn: 'Yes, Approve', color: 'bg-green-700 hover:bg-green-800' },
      reject: { text: 'Request changes?', btn: 'Yes, Request Changes', color: 'bg-orange-600 hover:bg-orange-700' },
      paid: { text: 'Mark as paid?', btn: 'Yes, Mark Paid', color: 'bg-blue-600 hover:bg-blue-700' },
    }
    const config = labels[confirmAction]

    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-gray-600">{config.text}</span>
        <button
          type="button"
          onClick={confirmAction === 'approve' ? handleApprove : confirmAction === 'reject' ? handleReject : handleMarkPaid}
          disabled={isLoading}
          className={`px-3 py-1.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${config.color}`}
        >
          {isLoading ? 'Processing...' : config.btn}
        </button>
        <button
          type="button"
          onClick={() => setConfirmAction(null)}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    )
  }

  // Show appropriate buttons based on status
  if (status === 'submitted') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirmAction('approve')}
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          ✅ Approve
        </button>
        <button
          type="button"
          onClick={() => setConfirmAction('reject')}
          disabled={isLoading}
          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
        >
          ↩️ Request Changes
        </button>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <button
        type="button"
        onClick={() => setConfirmAction('paid')}
        disabled={isLoading}
        className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        💰 Mark as Paid
      </button>
    )
  }

  return null
}
