/**
 * Receipt scanning Lambda handler.
 * Receives a base64-encoded image, sends to Bedrock (Claude) for extraction,
 * returns structured expense items.
 *
 * Routes:
 *   POST /scan — Extract items from an image
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { withAuth } from '../middleware/authMiddleware.js'
import { success, error } from '../utils/responses.js'

const bedrockClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'eu-west-1' })
const MODEL_ID = 'eu.anthropic.claude-haiku-4-5-20251001-v1:0'

const EXTRACTION_PROMPT = `You are an expense extraction assistant for a Nigerian household. 
Analyze this image (receipt, handwritten list, or shopping list) and extract all expense items.

For each item, provide:
- item: the item name — MUST match one of the known items listed below when possible
- category: the category that item belongs to (see list below)
- price: the price in Naira (number only, no currency symbol)

KNOWN ITEMS BY CATEGORY:
Food: Abacha, Achi, Akara, Aku, Akwu, Anyara Leaf, Banana, Beans, Bitter Leaf, Bread, Cabbage, Cameroon Pepper, Carrot, Chicken, Chinchin, Cocoyam, Crayfish, Cucumber, Curry, Dry pepper, Dryfish, Efo, Egg, Egusi, Ehuru, Ejakika, Eru, Fish, Fresh Pepper, Fresh Tomatoes, Fruits, Garlic, Garri, Ginger, Green Beans, Grounded Pepper, Groundnut Oil, Kpomo, Maggi, Meat, Moimoi, Ofo, Ogbono, Ogiri, Oha, Okpa, Okpei, Okporoko, Okro, Onions, Palm Oil, Pap, Plantain, Potatoes, Rice, Salt, Scent Leaf, Seasoning, Shoko, Shombo, Sweet Corn, Tatashi, Tin Tomatoes, Tomato Paste, Ugu, Ukazi, Ukpaka, Upaka, Uziza, Vegetables, Waterleaf, Wheat, Yam, Yellow Pepper

Provision: Biscuit, Butter, Coffee, Honey, Mayonnaise, Milk, Milo, Ovaltine, Quaker Oats, Sugar

Others: Air Freshener, Bathing Soap, Bleach, Broom, Dye, Electricity, Gas, Gotv, Hypo, Insecticide, Kerosene, Knife, Lawma, Mop, Omo, Sweeper, Toothpaste, Transport, Water

Mom's Drugs & Hosp. Exp: Aboniki, Amitriptyline, Amlodipine, Atorvastatin, Blood Tonic, Brustan N, Emcap, Escitalopram, Eye Antioxidant, Fish Oil, Gabapentin, Hospital Fee, Maxi Tears, Neurovite Forte, Paracetamol, Vitamin C, Vitamin E

Dad's Drugs & Hosp. Exp: Amlodipine, Atorvastatin, Brain Formula, Brimosopt Eyedrops, Epilim Chrono, Eye Antioxidant, Gabapentin, Micropost Eyedrop, Neurovite Forte, Nootropil, Sodium Valproate, Telmisartan, Vasoprin, Vitamin C, Vitamin E, Yeast

RULES:
- Use the EXACT item name from the list above when the item matches
- If an item is not in the list, use the common Nigerian market name
- Never translate Nigerian food names to English (e.g. use "Egusi" not "Eggplant")

Return ONLY a JSON array. No explanation. Example:
[{"item":"Meat","category":"Food","price":10000},{"item":"Gas","category":"Others","price":18000}]

If you cannot extract any items, return an empty array: []`

export const handler = withAuth(async (event) => {
  const { httpMethod, body } = event

  if (httpMethod !== 'POST') {
    return error(`Unsupported method: ${httpMethod}`, 405)
  }

  try {
    const data = parseBody(body)

    if (!data.image) {
      return error('Missing required field: image (base64-encoded)', 400)
    }

    // Extract media type and base64 data
    let mediaType = 'image/jpeg'
    let imageData = data.image

    // Handle data URL format (data:image/jpeg;base64,...)
    if (data.image.startsWith('data:')) {
      const match = data.image.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        mediaType = match[1]
        imageData = match[2]
      }
    }

    // Call Bedrock Claude with the image
    const bedrockPayload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: imageData,
              },
            },
            {
              type: 'text',
              text: EXTRACTION_PROMPT,
            },
          ],
        },
      ],
    }

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(bedrockPayload),
    })

    const response = await bedrockClient.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    // Extract the text content from Claude's response
    const textContent = responseBody.content?.[0]?.text || '[]'

    // Parse the JSON array from the response
    let items = []
    try {
      // Find JSON array in the response (Claude sometimes adds text around it)
      const jsonMatch = textContent.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0])
      }
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', textContent)
      return success({ items: [], message: 'Could not extract items from image' })
    }

    // Validate and clean items
    const validItems = items
      .filter((item) => item.item && item.price && item.category)
      .map((item) => ({
        item: String(item.item).trim(),
        category: normalizeCategory(item.category),
        price: Number(item.price) || 0,
      }))
      .filter((item) => item.price > 0)

    return success({
      items: validItems,
      count: validItems.length,
    })
  } catch (err) {
    console.error('Scan handler error:', err)

    if (err.name === 'AccessDeniedException') {
      return error('Bedrock model access not enabled. Please enable Claude in AWS Bedrock console.', 503)
    }

    return error('Failed to process image', 500)
  }
})

function normalizeCategory(cat) {
  const lower = (cat || '').toLowerCase()
  if (lower.includes('food')) return 'Food'
  if (lower.includes('provision')) return 'Provision'
  if (lower.includes('mom')) return "Mom's Drugs & Hosp. Exp"
  if (lower.includes('dad')) return "Dad's Drugs & Hosp. Exp"
  return 'Others'
}

function parseBody(body) {
  if (!body) return {}
  try { return JSON.parse(body) } catch { return {} }
}
