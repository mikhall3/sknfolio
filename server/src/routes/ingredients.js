import { Router } from 'express'
import Anthropic from '@anthropic-ai/sdk'
import { CURATED_INGREDIENTS } from '../data/ingredients.js'

const router = Router()

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    summary: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          key: { type: ['string', 'null'] },
        },
        required: ['label', 'key'],
        additionalProperties: false,
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['confidence', 'summary', 'ingredients', 'sources'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `You help identify the real ingredient list of skincare products for a personal skincare diary app. This is smart guidance to help someone spot potential ingredient conflicts in their own routine - it is not medical advice and should never be presented as a substitute for reading the actual product label or consulting a dermatologist.

Search the web for the actual, real ingredient list of the specific product named by the user (check the brand's official site, a major retailer listing, or an ingredient database like INCIDecoder). Do not guess from memory alone - verify with a search before answering.

Curated actives to match against (use these exact "key" values whenever a found ingredient corresponds to one of them):
${CURATED_INGREDIENTS.map((i) => `- ${i.key}: ${i.label}`).join('\n')}

For every real ingredient you find that is not in the curated list, still include it with "key": null and a plain-language "label".

Set "confidence" honestly:
- HIGH: you found this specific product's official ingredient list from a reliable source
- MEDIUM: you found a plausible match, but the source was a secondary database, an older formulation, or you are not fully certain it is the exact current product
- LOW: you could not find a reliable source and are inferring from the product's category or similar products

"summary" is one or two plain sentences, written for someone who is not a chemist, explaining what you found and how sure you are. "sources" lists the URLs you actually used.`

router.post('/detect', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Ingredient lookup is not configured on this server.' })
  }

  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Product name is required.' })
  const brand = req.body?.brand ? String(req.body.brand).trim() : ''
  const category = req.body?.category ? String(req.body.category) : undefined
  const fullName = brand ? `${brand} ${name}` : name

  try {
    const anthropic = new Anthropic()
    // Streamed rather than a single blocking call: a multi-round web search
    // lookup can genuinely take a minute or more, which risks a proxy/HTTP
    // timeout on a non-streaming request. A generous max_tokens gives the
    // model room to search several times, reason, and still write the full
    // JSON answer - 2048 was tight enough that answers were getting cut off
    // mid-response, which then failed to parse as JSON.
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Product: ${fullName}${category ? ` (category: ${category})` : ''}${
            brand ? `\nBrand: ${brand}\nProduct name: ${name}` : ''
          }`,
        },
      ],
    })
    const response = await stream.finalMessage()

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: "Couldn't look that up — try tagging ingredients manually." })
    }
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'That lookup ran out of room before finishing. Try again, or tag ingredients manually.' })
    }

    const textBlocks = response.content.filter((block) => block.type === 'text')
    const finalText = textBlocks[textBlocks.length - 1]?.text
    if (!finalText) {
      return res.status(502).json({ error: 'No result from ingredient lookup.' })
    }

    let parsed
    try {
      parsed = JSON.parse(finalText)
    } catch {
      console.error('Ingredient detection returned unparseable JSON:', finalText)
      return res.status(502).json({ error: 'Got an unreadable result. Try again, or tag ingredients manually.' })
    }
    res.json(parsed)
  } catch (err) {
    console.error('Ingredient detection failed:', err)
    res.status(502).json({ error: 'Ingredient lookup failed. Try tagging manually.' })
  }
})

export default router
