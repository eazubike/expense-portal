import { useState } from 'react'
import { buildSubmissionMessage, shareToWhatsApp } from '../../utils/whatsappShare'
import { formatWeekDate } from '../../utils/dateUtils'

/**
 * "Submit for Approval" button.
 * Triggers the week submission and opens WhatsApp with the formatted message.
 */
export default function SubmitButton({
  weekOf,
  weekStart,
  expenses = [],
  weeklyTotal = 0,
  onSubmit,
  isSubmitting = false,
}) {
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSubmit() {
    setShowConfirm(false)

    try {
      await onSubmit()

      // Build and share WhatsApp message
      const weekDate = formatWeekDate(weekStart)
      const appUrl = window.location.origin
      const message = buildSubmissionMessage(weekDate, weeklyTotal, expenses, appUrl)
      shareToWhatsApp(message)
    } catch (err) {
      console.error('Submit failed:', err)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Submit this week?</span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="px-3 py-1.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50"
        >
          {isSubmitting ? 'Submitting...' : 'Yes, Submit'}
        </button>
        <button
          type="button"
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowConfirm(true)}
      disabled={isSubmitting || expenses.length === 0}
      className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      📋 Submit for Approval
    </button>
  )
}
