/**
 * Templates Lambda handler.
 * CRUD operations for recurring expense templates.
 *
 * Routes:
 *   GET    /templates                — List all templates
 *   POST   /templates                — Create a new template
 *   PUT    /templates/{templateId}   — Update template name/items
 *   DELETE /templates/{templateId}   — Delete a template
 */

import { randomUUID } from 'crypto'
import { withAuth } from '../middleware/authMiddleware.js'
import { putItem, getItem, deleteItem, scanTable, TABLES } from '../services/dynamodb.js'
import { success, error, notFound } from '../utils/responses.js'
import { isValidCategory, isValidPrice, isValidItem } from '../utils/validators.js'

const MAX_TEMPLATES = 20
const MAX_ITEMS = 50
const MIN_ITEMS = 1
const MAX_NAME_LENGTH = 50

/**
 * Main Lambda handler — routes based on HTTP method.
 */
export const handler = withAuth(async (event) => {
  const { httpMethod, pathParameters, body } = event

  try {
    switch (httpMethod) {
      case 'GET':
        return await getTemplates(event)
      case 'POST':
        return await createTemplate(event, parseBody(body))
      case 'PUT':
        return await updateTemplate(event, pathParameters, parseBody(body))
      case 'DELETE':
        return await deleteTemplate(event, pathParameters)
      default:
        return error(`Unsupported method: ${httpMethod}`, 405)
    }
  } catch (err) {
    console.error('Templates handler error:', err)
    return error('Internal server error', 500)
  }
})

// ─── GET /templates ──────────────────────────────────────────────────────────

/**
 * List all templates.
 */
async function getTemplates(event) {
  const templates = await scanTable(TABLES.templates)

  // Sort by createdAt descending (newest first)
  templates.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))

  return success({ templates })
}

// ─── POST /templates ─────────────────────────────────────────────────────────

/**
 * Create a new template.
 * Validates: name uniqueness, 1-50 items, max 20 templates total.
 */
async function createTemplate(event, data) {
  // Check user role — only inputer or admin can create
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can create templates', 403)
  }

  // Validate name
  const nameErrors = validateTemplateName(data.name)
  if (nameErrors) {
    return error(nameErrors, 400)
  }

  // Validate items
  const itemErrors = validateTemplateItems(data.items)
  if (itemErrors) {
    return error(itemErrors, 400)
  }

  // Check max templates limit
  const existingTemplates = await scanTable(TABLES.templates)
  if (existingTemplates.length >= MAX_TEMPLATES) {
    return error(`Maximum ${MAX_TEMPLATES} templates allowed. Delete an existing template first.`, 400)
  }

  // Check name uniqueness (case-insensitive)
  const nameLower = data.name.trim().toLowerCase()
  const duplicate = existingTemplates.find(
    (t) => t.name.toLowerCase() === nameLower
  )
  if (duplicate) {
    return error(`A template with the name "${data.name.trim()}" already exists`, 409)
  }

  const now = new Date().toISOString()
  const template = {
    templateId: randomUUID(),
    name: data.name.trim(),
    items: data.items.map((item) => ({
      category: item.category,
      item: item.item.trim(),
      price: item.price,
    })),
    createdBy: event.user.userId,
    createdAt: now,
    updatedAt: now,
  }

  await putItem(TABLES.templates, template)

  return success({ template }, 201)
}

// ─── PUT /templates/{templateId} ─────────────────────────────────────────────

/**
 * Update a template's name and/or items.
 */
async function updateTemplate(event, pathParams, data) {
  const { templateId } = pathParams || {}

  if (!templateId) {
    return error('Missing path parameter: templateId', 400)
  }

  // Check user role
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can update templates', 403)
  }

  // Get existing template
  const existing = await getItem(TABLES.templates, { templateId })
  if (!existing) {
    return notFound('Template')
  }

  // Validate name if provided
  if (data.name !== undefined) {
    const nameErrors = validateTemplateName(data.name)
    if (nameErrors) {
      return error(nameErrors, 400)
    }

    // Check name uniqueness (exclude current template)
    const nameLower = data.name.trim().toLowerCase()
    const allTemplates = await scanTable(TABLES.templates)
    const duplicate = allTemplates.find(
      (t) => t.templateId !== templateId && t.name.toLowerCase() === nameLower
    )
    if (duplicate) {
      return error(`A template with the name "${data.name.trim()}" already exists`, 409)
    }
  }

  // Validate items if provided
  if (data.items !== undefined) {
    const itemErrors = validateTemplateItems(data.items)
    if (itemErrors) {
      return error(itemErrors, 400)
    }
  }

  // Must provide at least name or items
  if (data.name === undefined && data.items === undefined) {
    return error('Must provide name or items to update', 400)
  }

  const now = new Date().toISOString()
  const updatedTemplate = {
    ...existing,
    updatedAt: now,
  }

  if (data.name !== undefined) {
    updatedTemplate.name = data.name.trim()
  }
  if (data.items !== undefined) {
    updatedTemplate.items = data.items.map((item) => ({
      category: item.category,
      item: item.item.trim(),
      price: item.price,
    }))
  }

  await putItem(TABLES.templates, updatedTemplate)

  return success({ template: updatedTemplate })
}

// ─── DELETE /templates/{templateId} ──────────────────────────────────────────

/**
 * Delete a template.
 */
async function deleteTemplate(event, pathParams) {
  const { templateId } = pathParams || {}

  if (!templateId) {
    return error('Missing path parameter: templateId', 400)
  }

  // Check user role
  const userRole = event.user.role
  if (userRole !== 'inputer' && userRole !== 'admin') {
    return error('Only inputers can delete templates', 403)
  }

  // Check template exists
  const existing = await getItem(TABLES.templates, { templateId })
  if (!existing) {
    return notFound('Template')
  }

  await deleteItem(TABLES.templates, { templateId })

  return success({ message: 'Template deleted', templateId })
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate template name: 1-50 characters, non-empty after trim.
 * Returns error message string or null if valid.
 */
function validateTemplateName(name) {
  if (!name || typeof name !== 'string') {
    return 'Template name is required'
  }
  const trimmed = name.trim()
  if (trimmed.length < 1) {
    return 'Template name cannot be empty'
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return `Template name must be ${MAX_NAME_LENGTH} characters or less`
  }
  return null
}

/**
 * Validate template items array: 1-50 items, each with valid category/item/price.
 * Returns error message string or null if valid.
 */
function validateTemplateItems(items) {
  if (!Array.isArray(items)) {
    return 'Items must be an array'
  }
  if (items.length < MIN_ITEMS) {
    return `Template must have at least ${MIN_ITEMS} item`
  }
  if (items.length > MAX_ITEMS) {
    return `Template can have at most ${MAX_ITEMS} items`
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item || typeof item !== 'object') {
      return `Item ${i + 1}: must be an object with category, item, and price`
    }
    if (!item.category || !isValidCategory(item.category)) {
      return `Item ${i + 1}: invalid category`
    }
    if (!item.item || !isValidItem(item.item)) {
      return `Item ${i + 1}: item name must be 1-100 characters`
    }
    if (item.price === undefined || item.price === null || !isValidPrice(item.price)) {
      return `Item ${i + 1}: price must be a number between 0.01 and 999,999,999.99`
    }
  }

  return null
}

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
