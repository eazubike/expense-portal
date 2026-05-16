import apiClient from './client'

/**
 * Get all templates.
 * @returns {Promise<Array>}
 */
export async function getTemplates() {
  const { data } = await apiClient.get('/templates')
  return data.templates || []
}

/**
 * Create a new template.
 * @param {object} template - { name, items: [{ category, item, price }] }
 * @returns {Promise<object>}
 */
export async function createTemplate(template) {
  const { data } = await apiClient.post('/templates', template)
  return data.template
}

/**
 * Update an existing template.
 * @param {string} templateId
 * @param {object} updates - { name?, items? }
 * @returns {Promise<object>}
 */
export async function updateTemplate(templateId, updates) {
  const { data } = await apiClient.put(`/templates/${templateId}`, updates)
  return data.template
}

/**
 * Delete a template.
 * @param {string} templateId
 * @returns {Promise<void>}
 */
export async function deleteTemplate(templateId) {
  await apiClient.delete(`/templates/${templateId}`)
}
