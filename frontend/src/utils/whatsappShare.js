/**
 * WhatsApp sharing utilities.
 * Uses wa.me URL scheme for zero-cost sharing with fallback to Web Share API.
 */

import { formatCurrency } from './formatters'

/**
 * Build the submission message for WhatsApp.
 * Formats the itemized expense list grouped by category.
 *
 * @param {string} weekDate - Formatted week date string (e.g. "Sunday 22 February 2026")
 * @param {number} total - Total amount
 * @param {Array} items - Array of expense entries
 * @param {string} appUrl - App URL for review link
 * @returns {string} Formatted WhatsApp message
 */
export function buildSubmissionMessage(weekDate, total, items, appUrl) {
  const totalItems = items.length

  // Group items by category
  const grouped = items.reduce((acc, item) => {
    const cat = item.category || 'Others'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(item)
    return acc
  }, {})

  let message = `📋 *Expense for week of ${weekDate}*\n\n`
  message += `*Total: ${formatCurrency(total)} (${totalItems} items)*\n\n`

  // Add each category section
  for (const [category, categoryItems] of Object.entries(grouped)) {
    const catTotal = categoryItems.reduce((sum, i) => sum + (i.price || 0), 0)
    message += `*${category} (${categoryItems.length} items — ${formatCurrency(catTotal)}):*\n`

    for (const item of categoryItems) {
      message += `• ${item.item} — ${formatCurrency(item.price)}\n`
    }
    message += '\n'
  }

  message += `⏳ Waiting for approval and payment\n\n`
  message += `👉 Review: ${appUrl}`

  return message
}

/**
 * Build the approval notification message.
 *
 * @param {string} weekDate - Formatted week date string
 * @param {number} total - Total amount
 * @param {string} approverName - Name of the approver
 * @returns {string} Formatted WhatsApp message
 */
export function buildApprovalMessage(weekDate, total, approverName) {
  let message = `✅ *Expense Approved*\n\n`
  message += `Week of: ${weekDate}\n`
  message += `Total: ${formatCurrency(total)}\n`
  message += `Approved by: ${approverName}\n\n`
  message += `💰 Ready for payment`

  return message
}

/**
 * Build the reconciliation summary message.
 *
 * @param {string} weekDate - Formatted week date string
 * @param {Array} bought - Items that were purchased
 * @param {Array} notBought - Items that were not purchased
 * @param {number} finalTotal - Final total of purchased items
 * @returns {string} Formatted WhatsApp message
 */
export function buildReconciliationMessage(weekDate, bought, notBought, finalTotal) {
  const totalItems = bought.length + notBought.length

  let message = `📝 *Week Reconciled*\n\n`
  message += `Week of: ${weekDate}\n\n`
  message += `✅ Items bought: ${bought.length} of ${totalItems}\n`
  message += `❌ Items not bought: ${notBought.length}\n`
  message += `💰 Final total: ${formatCurrency(finalTotal)}\n`

  if (notBought.length > 0) {
    message += `\nNot purchased:\n`
    for (const item of notBought) {
      message += `• ${item.item} — ${formatCurrency(item.price)}\n`
    }
  }

  return message
}

/**
 * Build the approver removal notification message.
 *
 * @param {string} weekDate - Formatted week date string
 * @param {Array} removedItems - Items that were removed
 * @param {number} newTotal - Updated total after removals
 * @param {string} approverName - Name of the approver
 * @returns {string} Formatted WhatsApp message
 */
export function buildRemovalMessage(weekDate, removedItems, newTotal, approverName) {
  let message = `✂️ *Items Removed*\n\n`
  message += `Week of: ${weekDate}\n`
  message += `Removed by: ${approverName}\n\n`

  for (const item of removedItems) {
    message += `❌ ${item.item} — ${formatCurrency(item.price)}\n`
  }

  message += `\nUpdated total: ${formatCurrency(newTotal)}`

  return message
}

/**
 * Open WhatsApp with a pre-filled message.
 * Falls back to Web Share API or clipboard copy.
 *
 * @param {string} message - The message to share
 */
export function shareToWhatsApp(message) {
  const encoded = encodeURIComponent(message)
  const whatsappUrl = `https://wa.me/?text=${encoded}`

  // Try Web Share API first (works well on mobile)
  if (navigator.share) {
    navigator.share({ text: message }).catch(() => {
      // Fallback to WhatsApp URL
      window.open(whatsappUrl, '_blank')
    })
    return
  }

  // Fallback: open WhatsApp URL
  window.open(whatsappUrl, '_blank')
}
