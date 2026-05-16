import { useState, useEffect } from 'react'

/**
 * Prompt shown when a new service worker version is available.
 * Listens for the custom 'sw:update-available' event dispatched from main.jsx.
 */
export default function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false)

  useEffect(() => {
    function handleUpdateAvailable() {
      setShowUpdate(true)
    }

    window.addEventListener('sw:update-available', handleUpdateAvailable)

    return () => {
      window.removeEventListener('sw:update-available', handleUpdateAvailable)
    }
  }, [])

  if (!showUpdate) return null

  function handleUpdate() {
    // Reload the page to activate the new service worker
    window.location.reload()
  }

  function handleDismiss() {
    setShowUpdate(false)
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[100] bg-green-700 text-white text-sm py-3 px-4 flex items-center justify-between shadow-md"
    >
      <span>A new version is available.</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDismiss}
          className="px-3 py-1 text-xs rounded border border-white/40 hover:bg-white/10 transition-colors"
        >
          Later
        </button>
        <button
          type="button"
          onClick={handleUpdate}
          className="px-3 py-1 text-xs font-semibold rounded bg-white text-green-700 hover:bg-green-50 transition-colors"
        >
          Update
        </button>
      </div>
    </div>
  )
}
