import { useQuery } from '@tanstack/react-query'
import { getSettings } from '../api/settings'
import { CATEGORIES as DEFAULT_CATEGORIES } from '../data/itemCatalog'

/**
 * Hook to get dynamic categories from the settings API.
 * Falls back to the hardcoded defaults if API is unavailable.
 */
export function useCategories() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 1000 * 60 * 30, // 30 min cache
    enabled: !!import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL !== 'http://localhost:5173/api',
  })

  return settings?.categories || DEFAULT_CATEGORIES
}
