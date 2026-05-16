import apiClient from './client'

/**
 * Get all weeks with their computed status.
 * @returns {Promise<Array>}
 */
export async function getWeeks() {
  const { data } = await apiClient.get('/weeks')
  return data.weeks || []
}

/**
 * Get a single week's computed status.
 * @param {string} weekOf - ISO date of Sunday
 * @returns {Promise<object>}
 */
export async function getWeekStatus(weekOf) {
  const { data } = await apiClient.get(`/weeks/${weekOf}`)
  return data.week
}

/**
 * Submit all draft entries for a week (draft → submitted).
 * @param {string} weekOf
 * @returns {Promise<object>} - { message, count, weekOf }
 */
export async function submitWeek(weekOf) {
  const { data } = await apiClient.post(`/weeks/${weekOf}/submit`)
  return data
}

/**
 * Approve all submitted entries for a week (submitted → approved).
 * @param {string} weekOf
 * @returns {Promise<object>} - { message, count, weekOf }
 */
export async function approveWeek(weekOf) {
  const { data } = await apiClient.post(`/weeks/${weekOf}/approve`)
  return data
}

/**
 * Reject all submitted entries back to draft (submitted → draft).
 * @param {string} weekOf
 * @returns {Promise<object>} - { message, count, weekOf }
 */
export async function rejectWeek(weekOf) {
  const { data } = await apiClient.post(`/weeks/${weekOf}/reject`)
  return data
}

/**
 * Get the removal audit trail for a week.
 * @param {string} weekOf
 * @returns {Promise<Array>}
 */
export async function getWeekRemovals(weekOf) {
  const { data } = await apiClient.get(`/weeks/${weekOf}/removals`)
  return data.removals || []
}
