import apiClient from './client'

/**
 * Get app settings (includes categories).
 */
export async function getSettings() {
  const { data } = await apiClient.get('/settings')
  return data.settings || {}
}

/**
 * Update app settings (admin only).
 */
export async function updateSettings(settings) {
  const { data } = await apiClient.put('/settings', settings)
  return data
}
