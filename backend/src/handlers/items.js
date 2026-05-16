/**
 * Custom items Lambda handler.
 * Manages user-added items that extend the built-in catalog.
 *
 * Routes:
 *   GET    /items                      — Return all custom items
 *   POST   /items                      — Add a new custom item (inputer role)
 *   DELETE /items/{category}/{item}    — Remove a custom item (admin only)
 */

import { withAuth } from '../middleware/authMiddleware.js'
import { getItem, putItem, deleteItem, scanTable, TABLES } from '../services/dynamodb.js'
import { success, error, notFound } from '../utils/responses.js'
import { validateCustomItem } from '../utils/validators.js'

/**
 * Main Lambda handler — routes based on HTTP method.
 */
export const handler = withAuth(async (event) => {
  const { httpMethod, pathParameters, body } = event

  try {
    switch (httpMethod) {
      case 'GET':
        return await getItems()
      case 'POST':
        return await addItem(event, parseBody(body))
      case 'DELETE':
        return await removeItem(event, pathParameters)
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Items handler error:', err)
    return error('Internal server error', 500)
  }
})

// ─── GET /items ──────────────────────────────────────────────────────────────

/**
 * Return all custom items from the custom-items table.
 * The frontend merges these with the built-in catalog.
 */
async function getItems() {
  const items = await scanTable(TABLES.customItems)

  // Sort by category, then by item name
  items.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category)
    return a.item.localeCompare(b.item)
  })

  return success({ items })
}

// ─── POST /items ─────────────────────────────────────────────────────────────

/**
 * Add a new custom item to a category.
 * Only inputer or admin can add items.
 * Prevents duplicates within the same category.
 */
async function addItem(event, data) {
  // Check user role — only inputer or admin can add items
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can add custom items', 403)
  }

  // Validate input
  const validationErrors = validateCustomItem(data)
  if (validationErrors) {
    return error(validationErrors.join('; '), 400)
  }

  const category = data.category
  const item = data.item.trim()

  // Check for duplicate — item already exists in this category
  const existing = await getItem(TABLES.customItems, { category, item })
  if (existing) {
    return error(`Item "${item}" already exists in category "${category}"`, 409)
  }

  const now = new Date().toISOString()
  const customItem = {
    category,
    item,
    addedBy: event.user.userId,
    addedByName: event.user.displayName,
    addedAt: now,
  }

  await putItem(TABLES.customItems, customItem)

  return success({ item: customItem }, 201)
}

// ─── DELETE /items/{category}/{item} ─────────────────────────────────────────

/**
 * Remove a custom item from the catalog.
 * Only admin can delete custom items.
 */
async function removeItem(event, pathParams) {
  const { category, item } = pathParams || {}

  if (!category || !item) {
    return error('Missing path parameters: category and item required', 400)
  }

  // Check user role — only admin can delete custom items
  const userRole = event.user.role
  if (userRole !== 'admin') {
    return error('Only admins can delete custom items', 403)
  }

  // Decode URI components (category/item may contain special characters)
  const decodedCategory = decodeURIComponent(category)
  const decodedItem = decodeURIComponent(item)

  // Check if item exists
  const existing = await getItem(TABLES.customItems, {
    category: decodedCategory,
    item: decodedItem,
  })

  if (!existing) {
    return notFound('Custom item')
  }

  await deleteItem(TABLES.customItems, {
    category: decodedCategory,
    item: decodedItem,
  })

  return success({ message: 'Custom item deleted', category: decodedCategory, item: decodedItem })
}

// ─── Utilities ───────────────────────────────────────────────────────────────

/**
 * Safely parse JSON body, returning empty object on failure.
 */
function parseBody(body) {
  if (!body) return {}
  try {
    return JSON.parse(body)
  } catch {
    return {}
  }
}
