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
        properties: { label: { type: 'string' }, key: { type: ['string', 'null'] } },
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

const t0 = Date.now()
const log = (...args) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...args)

log('Starting - calling anthropic.messages.stream()...')
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
  messages: [{ role: 'user', content: 'Product: Ole Henriksen Banana Bright Eye Creme (category: EYE_CREAM)' }],
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
  log('last text block (first 300 chars):', textBlocks[textBlocks.length - 1]?.text?.slice(0, 300))
} catch (err) {
  clearInterval(watchdog)
  log('finalMessage() THREW:', err?.message || err)
  if (err?.status) log('  http status:', err.status)
  if (err?.error) log('  error body:', JSON.stringify(err.error))
}

log('Script finished.')
