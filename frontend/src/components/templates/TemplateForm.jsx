import { useState, useMemo, useRef } from 'react'
import { ITEM_CATALOG } from '../../data/itemCatalog'
import { formatCurrency } from '../../utils/formatters'
import { useCategories } from '../../hooks/useCategories'

const EMPTY_ITEM = { category: 'Food', item: '', price: '' }

/**
 * Create/edit template form with catalog-based item selection.
 */
export default function TemplateForm({ template, onSave, onCancel, isSaving }) {
  const CATEGORIES = useCategories()
  const isEditing = !!template
  const [name, setName] = useState(template?.name || '')
  const [items, setItems] = useState(
    template?.items?.map((i) => ({ ...i, price: String(i.price) })) || [{ ...EMPTY_ITEM }]
  )
  const [errors, setErrors] = useState({})
  const [activeItemIdx, setActiveItemIdx] = useState(null)
  const [itemSearch, setItemSearch] = useState('')
  const searchRef = useRef(null)

  // Items for the active item's category
  const availableItems = useMemo(() => {
    if (activeItemIdx === null) return []
    const cat = items[activeItemIdx]?.category || ''
    return (ITEM_CATALOG[cat] || []).slice().sort((a, b) => a.localeCompare(b))
  }, [activeItemIdx, items])

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return availableItems
    const q = itemSearch.toLowerCase()
    return availableItems.filter((i) => i.toLowerCase().includes(q))
  }, [availableItems, itemSearch])

  function handleAddItem() {
    if (items.length >= 50) return
    setItems([...items, { ...EMPTY_ITEM }])
  }

  function handleRemoveItem(index) {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== index))
  }

  function handleItemChange(index, field, value) {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    if (field === 'category') updated[index].item = '' // reset item on category change
    setItems(updated)
  }

  function handleOpenItemSheet(idx) {
    setActiveItemIdx(idx)
    setItemSearch('')
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  function handleSelectItem(itemName) {
    if (activeItemIdx !== null) {
      handleItemChange(activeItemIdx, 'item', itemName)
    }
    setActiveItemIdx(null)
    setItemSearch('')
  }

  function validate() {
    const newErrors = {}
    const trimmedName = name.trim()
    if (!trimmedName) newErrors.name = 'Template name is required'
    else if (trimmedName.length > 50) newErrors.name = 'Name must be 50 characters or less'

    const itemErrors = []
    items.forEach((item, idx) => {
      const errs = []
      if (!item.item || !item.item.trim()) errs.push('Item name required')
      const price = parseFloat(item.price)
      if (!item.price || isNaN(price) || price < 0.01) errs.push('Valid price required')
      if (errs.length > 0) itemErrors[idx] = errs.join(', ')
    })
    if (itemErrors.length > 0) newErrors.items = itemErrors

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return
    onSave({
      name: name.trim(),
      items: items.map((item) => ({
        category: item.category,
        item: item.item.trim(),
        price: parseFloat(item.price),
      })),
    })
  }

  const totalPrice = items.reduce((sum, item) => {
    const price = parseFloat(item.price)
    return sum + (isNaN(price) ? 0 : price)
  }, 0)

  return (
    <>
      <form onSubmit={handleSubmit} className="px-4 py-4 bg-white">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {isEditing ? 'Edit Template' : 'New Template'}
        </h2>

        {/* Template name */}
        <div className="mb-4">
          <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-1">
            Template Name
          </label>
          <input
            id="template-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Groceries"
            maxLength={50}
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            style={{ fontSize: '16px' }}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Items list */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Items ({items.length}/50)
            </label>
            <span className="text-xs text-gray-500">Total: {formatCurrency(totalPrice)}</span>
          </div>

          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="ml-auto text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Category */}
                <select
                  value={item.category}
                  onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                  className="w-full px-2 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-1 focus:ring-green-500 bg-white"
                  style={{ fontSize: '16px' }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {/* Item selector + price */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenItemSheet(idx)}
                    className={`flex-1 px-2 py-2 text-sm text-left border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-500 ${
                      item.item ? 'text-gray-900 border-gray-300' : 'text-gray-400 border-gray-300'
                    }`}
                    style={{ fontSize: '16px' }}
                  >
                    {item.item || 'Select item...'}
                  </button>
                  <div className="relative w-24">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₦</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                      placeholder="Price"
                      className="w-full pl-5 pr-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-500"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>

                {errors.items?.[idx] && (
                  <p className="mt-1 text-xs text-red-600">{errors.items[idx]}</p>
                )}
              </div>
            ))}
          </div>

          {items.length < 50 && (
            <button
              type="button"
              onClick={handleAddItem}
              className="mt-3 w-full py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              + Add Item
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 py-2.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : isEditing ? 'Update Template' : 'Create Template'}
          </button>
        </div>
      </form>

      {/* Bottom sheet for item selection */}
      {activeItemIdx !== null && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => { setActiveItemIdx(null); setItemSearch('') }}
          />
          <div className="relative bg-white rounded-t-2xl h-[70vh] flex flex-col">
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            <div className="px-4 pb-3">
              <input
                ref={searchRef}
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search items..."
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                style={{ fontSize: '16px' }}
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-safe">
              {filteredItems.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-gray-500">No items found</p>
                  {itemSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSelectItem(itemSearch.trim())}
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
                        onClick={() => handleSelectItem(itemName)}
                        className={`w-full text-left px-4 py-3 text-base rounded-lg transition-colors ${
                          items[activeItemIdx]?.item === itemName
                            ? 'bg-green-50 text-green-700 font-medium'
                            : 'text-gray-900 hover:bg-gray-50 active:bg-gray-100'
                        }`}
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
