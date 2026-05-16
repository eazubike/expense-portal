import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { scanReceipt } from '../../api/scan'
import { formatCurrency } from '../../utils/formatters'

/**
 * Receipt scanning component — capture photo, AI extracts items, review before adding.
 */
export default function ScanReceipt({ onConfirm, onCancel }) {
  const [step, setStep] = useState('capture') // 'capture' | 'processing' | 'review'
  const [extractedItems, setExtractedItems] = useState([])
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const scanMutation = useMutation({
    mutationFn: scanReceipt,
    onSuccess: (data) => {
      if (data.items && data.items.length > 0) {
        setExtractedItems(data.items.map((item, i) => ({ ...item, id: i, selected: true })))
        setStep('review')
      } else {
        setError('Could not extract any items from the image. Try a clearer photo.')
        setStep('capture')
      }
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to process image. Please try again.')
      setStep('capture')
    },
  })

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setStep('processing')

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result // data:image/jpeg;base64,...
      scanMutation.mutate(base64)
    }
    reader.readAsDataURL(file)
  }

  function handleToggleItem(id) {
    setExtractedItems(prev =>
      prev.map(item => item.id === id ? { ...item, selected: !item.selected } : item)
    )
  }

  function handlePriceChange(id, newPrice) {
    setExtractedItems(prev =>
      prev.map(item => item.id === id ? { ...item, price: Number(newPrice) || 0 } : item)
    )
  }

  function handleConfirm() {
    const selected = extractedItems
      .filter(item => item.selected && item.price > 0)
      .map(({ item, category, price }) => ({ item, category, price, purchased: false }))
    onConfirm(selected)
  }

  const selectedCount = extractedItems.filter(i => i.selected).length
  const selectedTotal = extractedItems.filter(i => i.selected).reduce((s, i) => s + (i.price || 0), 0)

  // Capture step
  if (step === 'capture') {
    return (
      <div className="px-4 py-6 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <div className="text-4xl">📸</div>
          <h3 className="text-base font-medium text-gray-900">Scan Receipt</h3>
          <p className="text-sm text-gray-500">
            Take a photo of a receipt or handwritten list. AI will extract items and prices.
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 active:bg-green-900 transition-colors flex items-center justify-center gap-2"
            >
              📷 Take Photo
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Processing step
  if (step === 'processing') {
    return (
      <div className="px-4 py-12 bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <div className="w-10 h-10 border-3 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-600">Analyzing image with AI...</p>
          <p className="text-xs text-gray-400">This may take a few seconds</p>
        </div>
      </div>
    )
  }

  // Review step
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-900">Review Extracted Items</h3>
          <p className="text-xs text-gray-500">{selectedCount} selected · {formatCurrency(selectedTotal)}</p>
        </div>
        <button
          type="button"
          onClick={() => { setStep('capture'); setExtractedItems([]) }}
          className="text-xs text-green-700 font-medium"
        >
          Rescan
        </button>
      </div>

      <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
        {extractedItems.map((item) => (
          <div key={item.id} className={`px-4 py-2.5 flex items-center gap-3 ${!item.selected ? 'opacity-40' : ''}`}>
            <button
              type="button"
              onClick={() => handleToggleItem(item.id)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center ${
                item.selected ? 'bg-green-600 border-green-600' : 'border-gray-300'
              }`}
            >
              {item.selected && (
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 truncate">{item.item}</p>
              <span className="text-[10px] text-gray-500">{item.category}</span>
            </div>

            <div className="relative w-20">
              <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">₦</span>
              <input
                type="number"
                value={item.price}
                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                className="w-full pl-4 pr-1 py-1 text-sm text-right border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                style={{ fontSize: '14px' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 flex gap-2 border-t border-gray-200">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={selectedCount === 0}
          className="flex-1 py-2.5 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 disabled:opacity-50 transition-colors"
        >
          Add {selectedCount} items as draft
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
