import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { CURATED_INGREDIENTS } from '../data/ingredients.js'

const router = Router()

// A lookup can take well over a minute (multiple web searches + reasoning),
// which is longer than most reverse proxies (including Replit's) will hold an
// HTTP request open for - the platform kills it with its own "Bad Gateway"
// long before our code gets a chance to respond, no matter how the request to
// Anthropic itself is made. So the lookup runs in the background and the
// client polls a short-lived job instead of waiting on one long request.
const jobs = new Map()
setInterval(
  () => {
    const cutoff = Date.now() - 10 * 60 * 1000
    for (const [id, job] of jobs) {
      if (job.createdAt < cutoff) jobs.delete(id)
    }
  },
  5 * 60 * 1000
).unref()

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

async function runLookup(jobId, { name, brand, category }) {
  const fullName = brand ? `${brand} ${name}` : name
  try {
    const anthropic = new Anthropic()
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
      jobs.set(jobId, { status: 'error', error: "Couldn't look that up — try tagging ingredients manually.", createdAt: Date.now() })
      return
    }
    if (response.stop_reason === 'max_tokens') {
      jobs.set(jobId, {
        status: 'error',
        error: 'That lookup ran out of room before finishing. Try again, or tag ingredients manually.',
        createdAt: Date.now(),
      })
      return
    }

    const textBlocks = response.content.filter((block) => block.type === 'text')
    const finalText = textBlocks[textBlocks.length - 1]?.text
    if (!finalText) {
      jobs.set(jobId, { status: 'error', error: 'No result from ingredient lookup.', createdAt: Date.now() })
      return
    }

    let parsed
    try {
      parsed = JSON.parse(finalText)
    } catch {
      console.error('Ingredient detection returned unparseable JSON:', finalText)
      jobs.set(jobId, {
        status: 'error',
        error: 'Got an unreadable result. Try again, or tag ingredients manually.',
        createdAt: Date.now(),
      })
      return
    }
    jobs.set(jobId, { status: 'done', result: parsed, createdAt: Date.now() })
  } catch (err) {
    console.error('Ingredient detection failed:', err)
    jobs.set(jobId, { status: 'error', error: 'Ingredient lookup failed. Try tagging manually.', createdAt: Date.now() })
  }
}

router.post('/detect', (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Ingredient lookup is not configured on this server.' })
  }

  const name = String(req.body?.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Product name is required.' })
  const brand = req.body?.brand ? String(req.body.brand).trim() : ''
  const category = req.body?.category ? String(req.body.category) : undefined

  const jobId = randomUUID()
  jobs.set(jobId, { status: 'pending', createdAt: Date.now() })
  runLookup(jobId, { name, brand, category })

  res.status(202).json({ jobId })
})

router.get('/detect/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Lookup not found — it may have expired. Try again.' })
  res.json(job)
})

export default router
