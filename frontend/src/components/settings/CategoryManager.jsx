import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSettings, updateSettings } from '../../api/settings'
import { CATEGORIES as DEFAULT_CATEGORIES } from '../../data/itemCatalog'

/**
 * Category management UI — admin can add/remove/reorder categories.
 */
export default function CategoryManager() {
  const queryClient = useQueryClient()
  const [newCategory, setNewCategory] = useState('')
  const [confirm, setConfirm] = useState(null) // index to delete

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 1000 * 60 * 30,
  })

  const categories = settings?.categories || DEFAULT_CATEGORIES

  const mutation = useMutation({
    mutationFn: (newCategories) => updateSettings({ categories: newCategories }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  })

  function handleAdd() {
    const trimmed = newCategory.trim()
    if (!trimmed || trimmed.length > 50) return
    if (categories.includes(trimmed)) return
    mutation.mutate([...categories, trimmed])
    setNewCategory('')
  }

  function handleRemove(index) {
    if (categories.length <= 1) return
    const updated = categories.filter((_, i) => i !== index)
    mutation.mutate(updated)
    setConfirm(null)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900">Categories</h3>
        <p className="text-xs text-gray-500 mt-0.5">Manage expense categories</p>
      </div>

      {/* Current categories */}
      <ul className="space-y-2">
        {categories.map((cat, idx) => (
          <li key={cat} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg">
            <span className="text-sm text-gray-900">{cat}</span>
            {confirm === idx ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  disabled={mutation.isPending}
                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(null)}
                  className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirm(idx)}
                disabled={categories.length <= 1 || mutation.isPending}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-30"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Add new category */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="New category name..."
          maxLength={50}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          style={{ fontSize: '16px' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newCategory.trim() || mutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          Add
        </button>
      </div>

      {mutation.isError && (
        <p className="text-xs text-red-600">Failed to update categories. Try again.</p>
      )}
    </div>
  )
}
