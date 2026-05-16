/**
 * Settings Lambda handler.
 * Manages app-level configuration including dynamic categories.
 *
 * Routes:
 *   GET    /settings              — Get all settings (includes categories)
 *   PUT    /settings              — Update settings (admin only)
 */

import { withAuth } from '../middleware/authMiddleware.js'
import { getItem, putItem, TABLES } from '../services/dynamodb.js'
import { success, error } from '../utils/responses.js'

// Default categories (used when no custom categories are stored)
const DEFAULT_CATEGORIES = [
  'Food',
  'Provision',
  'Others',
  "Mom's Drugs & Hosp. Exp",
  "Dad's Drugs & Hosp. Exp",
]

export const handler = withAuth(async (event) => {
  const { httpMethod, body } = event

  try {
    switch (httpMethod) {
      case 'GET':
        return await getSettings()
      case 'PUT':
        return await updateSettings(event, parseBody(body))
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Settings handler error:', err)
    return error('Internal server error', 500)
  }
})

/**
 * GET /settings — returns all settings including categories.
 */
async function getSettings() {
  const categoriesSetting = await getItem(TABLES.settings, { settingKey: 'categories' })
  const categories = categoriesSetting?.value || DEFAULT_CATEGORIES

  return success({
    settings: {
      categories,
    },
  })
}

/**
 * PUT /settings — update settings. Admin only.
 * Body: { categories: [...] }
 */
async function updateSettings(event, data) {
  const userRole = event.user.role
  if (userRole !== 'admin') {
    return error('Only admins can update settings', 403)
  }

  // Update categories if provided
  if (data.categories) {
    if (!Array.isArray(data.categories)) {
      return error('categories must be an array', 400)
    }
    if (data.categories.length === 0) {
      return error('Must have at least one category', 400)
    }
    if (data.categories.length > 20) {
      return error('Maximum 20 categories allowed', 400)
    }
    // Validate each category is a non-empty string
    for (const cat of data.categories) {
      if (typeof cat !== 'string' || cat.trim().length === 0 || cat.length > 50) {
        return error('Each category must be a non-empty string (max 50 chars)', 400)
      }
    }

    await putItem(TABLES.settings, {
      settingKey: 'categories',
      value: data.categories.map((c) => c.trim()),
      updatedAt: new Date().toISOString(),
      updatedBy: event.user.userId,
    })
  }

  return success({ message: 'Settings updated' })
}

function parseBody(body) {
  if (!body) return {}
  try { return JSON.parse(body) } catch { return {} }
}
