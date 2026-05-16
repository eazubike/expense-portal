import { useState, useMemo, useRef, useEffect } from 'react'
import { ITEM_CATALOG, CATEGORIES as DEFAULT_CATEGORIES } from '../../data/itemCatalog'
import { addCustomItem } from '../../api/expenses'
import { useCategories } from '../../hooks/useCategories'

/**
 * Expense entry form with category dropdown, searchable item selector,
 * price input, and purchased toggle.
 * Mobile-optimized with bottom sheet for item selection.
 */
export default function ExpenseForm({
  onSubmit,
  customItems = {},
  isSubmitting = false,
}) {
  const CATEGORIES = useCategories()
  const [category, setCategory] = useState('')
  const [item, setItem] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [price, setPrice] = useState('')
  const [showItemSheet, setShowItemSheet] = useState(false)
  const [errors, setErrors] = useState({})

  const searchInputRef = useRef(null)

  // Merge built-in catalog with custom items for the selected category
  const availableItems = useMemo(() => {
    if (!category) return []
    const builtIn = ITEM_CATALOG[category] || []
    const custom = customItems[category] || []
    const merged = [...new Set([...builtIn, ...custom])]
    merged.sort((a, b) => a.localeCompare(b))
    return merged
  }, [category, customItems])

  // Filter items by search query (case-insensitive substring match)
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return availableItems
    const query = itemSearch.toLowerCase()
    return availableItems.filter((i) => i.toLowerCase().includes(query))
  }, [availableItems, itemSearch])

  // Focus search input when bottom sheet opens
  useEffect(() => {
    if (showItemSheet) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [showItemSheet])

  function validate() {
    const newErrors = {}
    if (!category) newErrors.category = 'Select a category'
    if (!item.trim()) newErrors.item = 'Select or enter an item'
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
      newErrors.price = 'Enter a valid price'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    onSubmit({
      category,
      item: item.trim(),
      price: parseFloat(price),
      purchased: false,
    })

    // Reset form but keep category for quick entry
    setItem('')
    setItemSearch('')
    setPrice('')
    setErrors({})
  }

  function handleItemSelect(selectedItem) {
    setItem(selectedItem)
    setItemSearch('')
    setShowItemSheet(false)
    setErrors((prev) => ({ ...prev, item: undefined }))
  }

  function handleCustomItemSelect(customItemName) {
    // Select it immediately
    handleItemSelect(customItemName)
    // Also persist to DynamoDB so it appears in future dropdowns
    if (category && customItemName) {
      addCustomItem(category, customItemName).catch(() => {
        // Silently fail — the item is still used for this entry
      })
    }
  }

  function handleCategoryChange(e) {
    setCategory(e.target.value)
    setItem('')
    setItemSearch('')
    setErrors((prev) => ({ ...prev, category: undefined }))
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="px-4 py-4 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto space-y-3">
          {/* Category dropdown */}
          <div>
            <select
              value={category}
              onChange={handleCategoryChange}
              className={`w-full px-3 py-3 text-base border rounded-lg appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.category ? 'border-red-400' : 'border-gray-300'
              }`}
              style={{ fontSize: '16px' }}
              aria-label="Category"
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-xs text-red-500">{errors.category}</p>
            )}
          </div>

          {/* Item selector (opens bottom sheet on mobile) */}
          <div>
            <button
              type="button"
              onClick={() => category && setShowItemSheet(true)}
              disabled={!category}
              className={`w-full px-3 py-3 text-base text-left border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                errors.item ? 'border-red-400' : 'border-gray-300'
              } ${!category ? 'bg-gray-50 text-gray-400' : 'bg-white text-gray-900'}`}
              style={{ fontSize: '16px' }}
              aria-label="Select item"
            >
              {item || 'Select item...'}
            </button>
            {errors.item && (
              <p className="mt-1 text-xs text-red-500">{errors.item}</p>
            )}
          </div>

          {/* Price and purchased row */}
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-base">₦</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => {
                    setPrice(e.target.value)
                    setErrors((prev) => ({ ...prev, price: undefined }))
                  }}
                  placeholder="Price"
                  className={`w-full pl-8 pr-3 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                    errors.price ? 'border-red-400' : 'border-gray-300'
                  }`}
                  style={{ fontSize: '16px' }}
                  aria-label="Price"
                />
              </div>
              {errors.price && (
                <p className="mt-1 text-xs text-red-500">{errors.price}</p>
              )}
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 text-base font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            style={{ fontSize: '16px' }}
          >
            {isSubmitting ? 'Adding...' : 'Add Expense'}
          </button>
        </div>
      </form>

      {/* Bottom sheet for item selection */}
      {showItemSheet && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowItemSheet(false)}
            aria-hidden="true"
          />

          {/* Sheet content — fixed height so it doesn't collapse when filtering */}
          <div className="relative bg-white rounded-t-2xl h-[75vh] flex flex-col animate-slide-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Search input */}
            <div className="px-4 pb-3">
              <input
                ref={searchInputRef}
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ fontSize: '16px' }}
                aria-label="Search items"
              />
            </div>

            {/* Item list */}
            <div className="flex-1 overflow-y-auto px-2 pb-safe">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500">No items found</p>
                  {itemSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => handleCustomItemSelect(itemSearch.trim())}
                      className="mt-3 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100"
                    >
                      Add &ldquo;{itemSearch.trim()}&rdquo; as custom item
                    </button>
                  )}
                </div>
              ) : (
                <ul role="listbox" aria-label="Available items">
                  {filteredItems.map((itemName) => (
                    <li key={itemName}>
                      <button
                        type="button"
                        onClick={() => handleItemSelect(itemName)}
                        className={`w-full text-left px-4 py-3 text-base rounded-lg transition-colors ${
                          item === itemName
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'text-gray-900 hover:bg-gray-50 active:bg-gray-100'
                        }`}
                        role="option"
                        aria-selected={item === itemName}
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
