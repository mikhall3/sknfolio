// One-off diagnostic: runs the exact same Anthropic call ingredients.js uses
// (streaming, adaptive thinking, web_search tool, structured JSON output),
// but logs a timestamped line for every event so we can see exactly where a
// stuck lookup stalls instead of just "it timed out after 3 minutes."
import 'dotenv/config'
import Anthropic from '@anthropic-ai/sdk'
import { CURATED_INGREDIENTS } from '../src/data/ingredients.js'

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
          ewgConcern: { type: ['string', 'null'] },
        },
        required: ['label', 'key', 'ewgConcern'],
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

For each ingredient, also set "ewgConcern": if ingredient safety databases (such as EWG's Skin Deep) are known to flag that specific ingredient for a notable hazard concern (e.g. endocrine disruption, allergen, contamination risk), summarize the concern itself in under 15 words as a plain, hedged caution - e.g. "May be linked to possible endocrine disruption in some studies" - never naming EWG, Skin Deep, or any other specific database in the text (that's an internal detail, not something to tell the user; it should read like general skincare knowledge, not established fact). Use your existing knowledge of well-known ingredient safety ratings rather than spending a search on every single one. If nothing notably flags an ingredient, or you are not confident it does, set "ewgConcern" to null - never guess or invent a concern.

Set "confidence" honestly:
- HIGH: you found this specific product's official ingredient list from a reliable source
- MEDIUM: you found a plausible match, but the source was a secondary database, an older formulation, or you are not fully certain it is the exact current product
- LOW: you could not find a reliable source and are inferring from the product's category or similar products

"summary" is exactly ONE short, plain sentence (under ~20 words) written for someone who is not a chemist, describing the product itself and its standout ingredients - not how you found it. Never name INCIDecoder, or any other specific source/database, in the summary - that's an internal detail, not something to tell the user. "sources" (a separate field, never shown in the summary) lists the URLs you actually used.`

const t0 = Date.now()
const log = (...args) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...args)

const productArg = process.argv.slice(2).join(' ').trim()
const productLine = productArg || 'Prequel Pre-Gleanse Oil (category: CLEANSING_BALM_OIL)'

log('Starting - calling anthropic.messages.stream()...')
log('Product:', productLine)
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set in this process environment. Stopping.')
  process.exit(1)
}

const anthropic = new Anthropic()
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-5',
  max_tokens: 8000,
  thinking: { type: 'adaptive' },
  tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3 }],
  output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA }, effort: 'medium' },
  system: SYSTEM_PROMPT,
  messages: [{ role: 'user', content: `Product: ${productLine}` }],
})

stream.on('connect', () => log('event: connect (request sent, waiting on response)'))
stream.on('streamEvent', (event) => log('event: streamEvent', event.type))
stream.on('contentBlock', (block) => log('event: contentBlock complete', block.type))
stream.on('message', (msg) => log('event: message complete, stop_reason =', msg.stop_reason))
stream.on('error', (err) => log('event: error', err?.message || err))
stream.on('abort', (err) => log('event: abort', err?.message || err))
stream.on('end', () => log('event: end (stream fully closed)'))

const watchdog = setInterval(() => log('...still waiting...'), 10000)

try {
  const finalMessage = await stream.finalMessage()
  clearInterval(watchdog)
  log('finalMessage() resolved. stop_reason =', finalMessage.stop_reason)
  const textBlocks = finalMessage.content.filter((b) => b.type === 'text')
  log('text blocks found:', textBlocks.length)
  log('full last text block:', textBlocks[textBlocks.length - 1]?.text)
} catch (err) {
  clearInterval(watchdog)
  log('finalMessage() THREW:', err?.message || err)
  if (err?.status) log('  http status:', err.status)
  if (err?.error) log('  error body:', JSON.stringify(err.error))
}

log('Script finished.')
