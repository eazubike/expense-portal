/**
 * Colored status badge for week approval status.
 * Draft=grey, Submitted=orange, Approved=green, Paid=blue, Reconciled=purple
 */

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700 border-gray-200',
  submitted: 'bg-orange-100 text-orange-700 border-orange-200',
  approved: 'bg-green-100 text-green-700 border-green-200',
  paid: 'bg-blue-100 text-blue-700 border-blue-200',
  reconciled: 'bg-purple-100 text-purple-700 border-purple-200',
}

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  paid: 'Paid',
  reconciled: 'Reconciled',
}

export default function StatusBadge({ status = 'draft', size = 'sm' }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft
  const label = STATUS_LABELS[status] || 'Draft'

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${style} ${sizeClasses[size] || sizeClasses.sm}`}
    >
      {label}
    </span>
  )
}
