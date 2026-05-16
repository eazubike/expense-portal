import apiClient from './client'

/**
 * Send an image to the scan API for AI extraction.
 * @param {string} imageBase64 - Base64-encoded image (with or without data URL prefix)
 * @returns {Promise<{items: Array, count: number}>}
 */
export async function scanReceipt(imageBase64) {
  const { data } = await apiClient.post('/scan', { image: imageBase64 })
  return data
}
