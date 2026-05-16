import { useOnlineStatus } from '../../hooks/useOnlineStatus'

/**
 * Banner displayed at the top of the app when the device is offline.
 * Automatically hides when the connection is restored.
 */
export default function OfflineBanner() {
  const { isOnline } = useOnlineStatus()

  if (isOnline) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-amber-500 text-amber-950 text-center text-sm font-medium py-2 px-4"
    >
      You're offline. Data is read-only.
    </div>
  )
}
