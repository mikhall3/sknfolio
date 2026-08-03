import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { CURATED_INGREDIENTS } from '../data/ingredients.js'
import { prisma } from '../db.js'

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

STEP 1 - Search INCIDecoder first. Go to https://incidecoder.com/search?query=PRODUCT+NAME (replacing PRODUCT NAME with the product, URL-encoded) and find the matching product. Open the product page on INCIDecoder and read the full ingredient list from there. INCIDecoder is the preferred source because it has verified INCI lists for thousands of products.

STEP 2 - If INCIDecoder does not have the product (no matching result or no ingredient list on the page), fall back to the brand's official site or a major retailer listing. Do not guess from memory alone - always verify with a search.

Curated actives to match against (use these exact "key" values whenever a found ingredient corresponds to one of them):
${CURATED_INGREDIENTS.map((i) => `- ${i.key}: ${i.label}`).join('\n')}

Only return ingredients that actually matter to someone tracking their skincare routine - never the full INCI list. Always include every curated active you find (matched by key). Beyond those, add at most a couple of other ingredients only if they are genuinely notable - a standout brand-marketed active, or something with real irritation/conflict potential. Do not include base or vehicle ingredients (water, common emulsifiers, thickeners, silicones, preservatives, pH adjusters, fragrance, etc.) even though they're on the real label - that's noise for this purpose. Return at most 5 ingredients total, most important first.

Set "confidence" honestly:
- HIGH: you found this specific product's official ingredient list from a reliable source
- MEDIUM: you found a plausible match, but the source was a secondary database, an older formulation, or you are not fully certain it is the exact current product
- LOW: you could not find a reliable source and are inferring from the product's category or similar products

"summary" is one or two plain sentences, written for someone who is not a chemist, explaining what you found and how sure you are. "sources" lists the URLs you actually used.`

function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const CURATED_KEYS = new Set(CURATED_INGREDIENTS.map((i) => i.key))

// Hard backstop independent of prompt compliance: keeps every curated active
// the model found, then fills any remaining room (up to 5 total) with the
// next most notable non-curated ingredients - so a product never ends up
// tagged with its full base/vehicle ingredient list.
function capIngredients(result, maxTotal = 5) {
  const ingredients = result.ingredients || []
  const curated = ingredients.filter((i) => i.key && CURATED_KEYS.has(i.key))
  const others = ingredients.filter((i) => !(i.key && CURATED_KEYS.has(i.key)))
  const remaining = Math.max(0, maxTotal - curated.length)
  return { ...result, ingredients: [...curated, ...others.slice(0, remaining)] }
}

// Ends a job with the given status/result, preserving any productId that was
// attached to it in the meantime, and returns that productId so the caller
// can write the result straight to the database - this is what makes the
// lookup durable even if the browser tab that started it is long gone.
function finishJob(jobId, patch) {
  const productId = jobs.get(jobId)?.productId
  jobs.set(jobId, { ...patch, productId, createdAt: Date.now() })
  return productId
}

async function applyResultToProduct(productId, result) {
  const existingTags = await prisma.productIngredient.findMany({ where: { productId }, select: { key: true } })
  const existingKeys = new Set(existingTags.map((t) => t.key))
  const additions = []
  for (const ing of result.ingredients || []) {
    const key = ing.key || slugify(ing.label || '')
    if (!key || existingKeys.has(key)) continue
    existingKeys.add(key)
    additions.push({ productId, key, label: ing.label, confidence: result.confidence, source: 'ai', verified: true })
  }
  await prisma.$transaction([
    ...(additions.length ? [prisma.productIngredient.createMany({ data: additions, skipDuplicates: true })] : []),
    prisma.product.update({
      where: { id: productId },
      data: { ingredientLookupStatus: 'DONE', ingredientLookupError: null, ingredientLookupSummary: result.summary || null },
    }),
  ])
}

async function markProductLookupError(productId, message) {
  // The product may have been deleted while the lookup was still running.
  await prisma.product
    .update({ where: { id: productId }, data: { ingredientLookupStatus: 'ERROR', ingredientLookupError: message } })
    .catch(() => {})
}

async function runLookup(jobId, { name, brand, category }) {
  const fullName = brand ? `${brand} ${name}` : name
  try {
    const anthropic = new Anthropic()
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
      output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA }, effort: 'medium' },
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
      const error = "Couldn't look that up — try tagging ingredients manually."
      const productId = finishJob(jobId, { status: 'error', error })
      if (productId) await markProductLookupError(productId, error)
      return
    }
    if (response.stop_reason === 'max_tokens') {
      const error = 'That lookup ran out of room before finishing. Try again, or tag ingredients manually.'
      const productId = finishJob(jobId, { status: 'error', error })
      if (productId) await markProductLookupError(productId, error)
      return
    }

    const textBlocks = response.content.filter((block) => block.type === 'text')
    const finalText = textBlocks[textBlocks.length - 1]?.text
    if (!finalText) {
      const error = 'No result from ingredient lookup.'
      const productId = finishJob(jobId, { status: 'error', error })
      if (productId) await markProductLookupError(productId, error)
      return
    }

    let parsed
    try {
      parsed = JSON.parse(finalText)
    } catch {
      console.error('Ingredient detection returned unparseable JSON:', finalText)
      const error = 'Got an unreadable result. Try again, or tag ingredients manually.'
      const productId = finishJob(jobId, { status: 'error', error })
      if (productId) await markProductLookupError(productId, error)
      return
    }
    parsed = capIngredients(parsed)

    const productId = finishJob(jobId, { status: 'done', result: parsed })
    if (productId) {
      await applyResultToProduct(productId, parsed).catch((err) => {
        console.error('Failed to save ingredient lookup result to product:', err)
        return markProductLookupError(productId, 'Found ingredients but failed to save them. Try tagging manually.')
      })
    }
  } catch (err) {
    console.error('Ingredient detection failed:', err)
    const error = 'Ingredient lookup failed. Try tagging manually.'
    const productId = finishJob(jobId, { status: 'error', error })
    if (productId) await markProductLookupError(productId, error)
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

// Links an in-flight (or already-finished) lookup job to a product so the
// result lands on that product no matter what happens to the browser tab
// that kicked the lookup off - closed, reloaded, offline, whatever. Any page
// viewing the product can then just watch its ingredientLookupStatus field.
router.post('/detect/:jobId/attach', async (req, res) => {
  const productId = String(req.body?.productId || '').trim()
  if (!productId) return res.status(400).json({ error: 'productId is required.' })
  const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user.id } })
  if (!product) return res.status(404).json({ error: 'Product not found.' })

  const job = jobs.get(req.params.jobId)
  if (!job) {
    await markProductLookupError(productId, "That lookup expired before it could finish — try again from the product's detail page.")
    return res.status(404).json({ error: 'Lookup not found — it may have expired.' })
  }

  if (job.status === 'done') {
    await applyResultToProduct(productId, job.result)
  } else if (job.status === 'error') {
    await markProductLookupError(productId, job.error)
  } else {
    await prisma.product.update({
      where: { id: productId },
      data: { ingredientLookupStatus: 'PENDING', ingredientLookupStartedAt: new Date(), ingredientLookupError: null },
    })
    jobs.set(req.params.jobId, { ...job, productId })
  }

  res.status(204).end()
})

export default router
