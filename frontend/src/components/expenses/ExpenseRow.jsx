import { useState, useRef, useMemo } from 'react'
import { useSwipe } from '../../hooks/useSwipe'
import CurrencyDisplay from '../common/CurrencyDisplay'
import { formatCurrency } from '../../utils/formatters'
import { ITEM_CATALOG } from '../../data/itemCatalog'
import { useCategories } from '../../hooks/useCategories'

/**
 * Category badge color mapping.
 */
const CATEGORY_COLORS = {
  'Food': 'bg-orange-100 text-orange-700',
  'Provision': 'bg-blue-100 text-blue-700',
  'Others': 'bg-purple-100 text-purple-700',
  "Mom's Drugs & Hosp. Exp": 'bg-pink-100 text-pink-700',
  "Dad's Drugs & Hosp. Exp": 'bg-teal-100 text-teal-700',
}

/**
 * Status indicator styles.
 */
const STATUS_STYLES = {
  draft: 'bg-gray-400',
  submitted: 'bg-orange-400',
  approved: 'bg-green-500',
}

/**
 * Single expense row with inline edit, swipe-to-delete, and purchased toggle.
 * Tap the row to enter edit mode (draft items only for inputer).
 */
export default function ExpenseRow({
  entry,
  userRole = 'inputer',
  onTogglePurchased,
  onUpdatePrice,
  onUpdateEntry,
  onDelete,
  onRemove,
}) {
  const CATEGORIES = useCategories()
  const [isEditing, setIsEditing] = useState(false)
  const [editItem, setEditItem] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [showItemSheet, setShowItemSheet] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const searchInputRef = useRef(null)

  const entryStatus = entry.status || 'draft'
  const isDraft = entryStatus === 'draft'
  const isSubmitted = entryStatus === 'submitted'
  const isApprover = userRole === 'approver' || userRole === 'admin'
  const isInputer = userRole === 'inputer' || userRole === 'admin'

  // Inputer can only delete/edit draft items
  const canDelete = isDraft && isInputer
  const canEdit = isDraft && isInputer
  // Approver can remove submitted items
  const canRemove = isSubmitted && isApprover

  // Items for the selected category
  const availableItems = useMemo(() => {
    if (!editCategory) return []
    const items = ITEM_CATALOG[editCategory] || []
    return [...items].sort((a, b) => a.localeCompare(b))
  }, [editCategory])

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return availableItems
    const query = itemSearch.toLowerCase()
    return availableItems.filter((i) => i.toLowerCase().includes(query))
  }, [availableItems, itemSearch])

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => canDelete && setShowDelete(true),
    onSwipeRight: () => setShowDelete(false),
    threshold: 60,
  })

  function handleRowTap() {
    if (!canEdit || isEditing) return
    setEditItem(entry.item)
    setEditPrice(String(entry.price))
    setEditCategory(entry.category)
    setItemSearch('')
    setIsEditing(true)
  }

  function handleSave() {
    const newPrice = parseFloat(editPrice)
    const trimmedItem = editItem.trim()

    if (!trimmedItem || isNaN(newPrice) || newPrice <= 0) {
      setIsEditing(false)
      return
    }

    const hasChanges =
      trimmedItem !== entry.item ||
      newPrice !== entry.price ||
      editCategory !== entry.category

    if (hasChanges) {
      if (onUpdateEntry) {
        onUpdateEntry(entry.weekOf, entry.entryId, {
          item: trimmedItem,
          price: newPrice,
          category: editCategory,
        })
      } else if (newPrice !== entry.price) {
        onUpdatePrice(entry.weekOf, entry.entryId, newPrice)
      }
    }
    setIsEditing(false)
  }

  function handleCancel() {
    setIsEditing(false)
    setShowItemSheet(false)
  }

  function handleItemSelect(selectedItem) {
    setEditItem(selectedItem)
    setItemSearch('')
    setShowItemSheet(false)
  }

  function handleCategoryChange(e) {
    setEditCategory(e.target.value)
    setEditItem('') // reset item when category changes
  }

  const categoryColor = CATEGORY_COLORS[entry.category] || 'bg-gray-100 text-gray-700'

  // Edit mode
  if (isEditing) {
    return (
      <>
        <div className="px-4 py-3 bg-green-50 border-b border-green-200 space-y-2">
          {/* Category dropdown */}
          <select
            value={editCategory}
            onChange={handleCategoryChange}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            style={{ fontSize: '16px' }}
            aria-label="Edit category"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Item selector (opens bottom sheet) */}
          <button
            type="button"
            onClick={() => setShowItemSheet(true)}
            className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ fontSize: '16px' }}
            aria-label="Select item"
          >
            {editItem || 'Select item...'}
          </button>

          {/* Price */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">₦</span>
            <input
              type="number"
              inputMode="decimal"
              value={editPrice}
              onChange={(e) => setEditPrice(e.target.value)}
              className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              style={{ fontSize: '16px' }}
              aria-label="Edit price"
            />
          </div>

          {/* Save / Cancel buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Bottom sheet for item selection */}
        {showItemSheet && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowItemSheet(false)}
              aria-hidden="true"
            />
            <div className="relative bg-white rounded-t-2xl h-[70vh] flex flex-col">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-4 pb-3">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search items..."
                  className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  style={{ fontSize: '16px' }}
                  autoFocus
                  aria-label="Search items"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-safe">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500">No items found</p>
                    {itemSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => handleItemSelect(itemSearch.trim())}
                        className="mt-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                      >
                        Use &ldquo;{itemSearch.trim()}&rdquo;
                      </button>
                    )}
                  </div>
                ) : (
                  <ul role="listbox">
                    {filteredItems.map((itemName) => (
                      <li key={itemName}>
                        <button
                          type="button"
                          onClick={() => handleItemSelect(itemName)}
                          className={`w-full text-left px-4 py-3 text-base rounded-lg transition-colors ${
                            editItem === itemName
                              ? 'bg-green-50 text-green-700 font-medium'
                              : 'text-gray-900 hover:bg-gray-50 active:bg-gray-100'
                          }`}
                          role="option"
                          aria-selected={editItem === itemName}
                        >
                          {itemName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // Normal display mode
  return (
    <div className="relative overflow-hidden" {...swipeHandlers}>
      {/* Delete action revealed on swipe */}
      {showDelete && canDelete && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            type="button"
            onClick={() => onDelete(entry)}
            className="h-full px-5 bg-red-600 text-white text-sm font-medium flex items-center"
            aria-label={`Delete ${entry.item}`}
          >
            Delete
          </button>
        </div>
      )}

      <div
        className={`group flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 transition-transform ${
          showDelete && canDelete ? '-translate-x-20' : 'translate-x-0'
        } ${canEdit ? 'cursor-pointer active:bg-gray-50' : ''}`}
        onClick={() => {
          if (showDelete) { setShowDelete(false); return }
          handleRowTap()
        }}
      >
        {/* Status indicator dot */}
        <span
          className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${STATUS_STYLES[entryStatus] || STATUS_STYLES.draft}`}
          title={entryStatus}
          aria-label={`Status: ${entryStatus}`}
        />

        {/* Purchased checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onTogglePurchased(entry.weekOf, entry.entryId, !entry.purchased)
          }}
          className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            entry.purchased
              ? 'bg-green-600 border-green-600'
              : 'border-gray-300 hover:border-green-400'
          }`}
          aria-label={entry.purchased ? 'Mark as not purchased' : 'Mark as purchased'}
        >
          {entry.purchased && (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${entry.purchased ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
            {entry.item}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-medium rounded ${categoryColor}`}>
              {entry.category}
            </span>
            {canEdit && (
              <span className="text-[10px] text-gray-400">tap to edit</span>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="flex flex-col items-end gap-0.5">
          <CurrencyDisplay amount={entry.price} size="sm" className="text-gray-900" />
          {entry.runningTotal != null && (
            <span className="text-[10px] text-gray-400 font-mono">
              Σ {formatCurrency(entry.runningTotal)}
            </span>
          )}
        </div>

        {/* Approver remove button — only for submitted items */}
        {canRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove && onRemove(entry) }}
            className="ml-2 flex-shrink-0 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 active:bg-red-200 transition-colors"
            aria-label={`Remove ${entry.item}`}
          >
            Remove
          </button>
        )}

        {/* Delete button — only for draft items (inputer) */}
        {canDelete && !canRemove && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(entry) }}
            className="ml-1 flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
            aria-label={`Delete ${entry.item}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
