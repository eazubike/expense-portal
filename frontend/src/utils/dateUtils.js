/**
 * Week calculation helpers.
 * Weeks start on Sunday and end on Saturday.
 */

/**
 * Get the Sunday of the week containing the given date.
 * @param {Date} date
 * @returns {Date} Sunday at midnight
 */
export function getWeekStart(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - day)
  return d
}

/**
 * Get the Saturday of the week containing the given date.
 * @param {Date} date
 * @returns {Date} Saturday at 23:59:59
 */
export function getWeekEnd(date = new Date()) {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

/**
 * Format a date as ISO date string (YYYY-MM-DD) for API weekOf param.
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format a date as "Sunday 22 February 2026".
 * @param {Date} date
 * @returns {string}
 */
export function formatWeekDate(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Navigate to the previous week's Sunday.
 * @param {Date} currentWeekStart - The current week's Sunday
 * @returns {Date}
 */
export function getPreviousWeek(currentWeekStart) {
  const prev = new Date(currentWeekStart)
  prev.setDate(prev.getDate() - 7)
  return prev
}

/**
 * Navigate to the next week's Sunday.
 * @param {Date} currentWeekStart - The current week's Sunday
 * @returns {Date}
 */
export function getNextWeek(currentWeekStart) {
  const next = new Date(currentWeekStart)
  next.setDate(next.getDate() + 7)
  return next
}

/**
 * Check if a given week is the current week.
 * @param {Date} weekStart
 * @returns {boolean}
 */
export function isCurrentWeek(weekStart) {
  const now = getWeekStart(new Date())
  return toISODate(weekStart) === toISODate(now)
}

/**
 * Parse an ISO date string into a Date object (local timezone).
 * @param {string} isoDate - e.g. "2026-02-22"
 * @returns {Date}
 */
export function parseISODate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year, month - 1, day)
}
