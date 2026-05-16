import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'

/**
 * List saved templates with Apply/Edit/Delete buttons.
 */
export default function TemplateList({ templates, isLoading, onApply, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!templates || templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-4xl mb-3" aria-hidden="true">📋</div>
        <h3 className="text-base font-medium text-gray-900">No templates yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Create a template to quickly add recurring expenses each week.
        </p>
      </div>
    )
  }

  function handleDeleteClick(template) {
    setConfirmDelete(template.templateId)
  }

  function handleConfirmDelete(template) {
    onDelete(template.templateId)
    setConfirmDelete(null)
  }

  return (
    <div className="divide-y divide-gray-100">
      {templates.map((template) => {
        const totalPrice = template.items.reduce((sum, item) => sum + (item.price || 0), 0)
        const isDeleting = confirmDelete === template.templateId

        return (
          <div key={template.templateId} className="px-4 py-3 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {template.name}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {template.items.length} item{template.items.length !== 1 ? 's' : ''} · {formatCurrency(totalPrice)}
                </p>
              </div>
            </div>

            {/* Item preview (first 3 items) */}
            <div className="mt-2 flex flex-wrap gap-1">
              {template.items.slice(0, 3).map((item, idx) => (
                <span
                  key={idx}
                  className="inline-block px-2 py-0.5 text-[10px] bg-gray-100 text-gray-600 rounded"
                >
                  {item.item}
                </span>
              ))}
              {template.items.length > 3 && (
                <span className="inline-block px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded">
                  +{template.items.length - 3} more
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onApply(template)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => onEdit(template)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                Edit
              </button>
              {isDeleting ? (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-red-600">Delete?</span>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(template)}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteClick(template)}
                  className="ml-auto px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 active:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
