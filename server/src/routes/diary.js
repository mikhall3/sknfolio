import { Router } from 'express'
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../db.js'
import { parseDateOnly, formatDateOnly } from '../lib/dates.js'
import { CURATED_INGREDIENTS } from '../data/ingredients.js'

const router = Router()

const logInclude = {
  logs: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      product: { include: { ingredientTags: true, notes: { orderBy: { date: 'desc' } } } },
    },
  },
}

// Fingerprints exactly what a review was generated from (which products were
// logged that day, plus the note text) so we can tell later whether the day
// has since changed, without having to regenerate anything just to check.
function reviewSignature(products, note) {
  return createHash('sha256')
    .update(JSON.stringify({ ids: products.map((p) => p.id).sort(), note: note || '' }))
    .digest('hex')
}

function serializeEntry(date, entry) {
  const am = []
  const pm = []
  for (const log of entry?.logs || []) {
    const target = log.period === 'AM' ? am : pm
    target.push({ logId: log.id, product: log.product })
  }

  let review = null
  if (entry?.routineReviewSummary) {
    const products = [...new Map((entry.logs || []).map((l) => [l.product.id, l.product])).values()]
    review = {
      summary: entry.routineReviewSummary,
      pairing: entry.routineReviewPairing,
      tomorrow: entry.routineReviewTomorrow,
      generatedAt: entry.routineReviewGeneratedAt,
      stale: entry.routineReviewSignature !== reviewSignature(products, entry.note),
    }
  }

  return {
    date: formatDateOnly(date),
    note: entry?.note || '',
    am,
    pm,
    review,
  }
}

router.get('/:date', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    include: logInclude,
  })

  res.json({ entry: serializeEntry(date, entry) })
})

router.put('/:date/note', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })
  const note = String(req.body?.note ?? '')

  const entry = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: req.user.id, date } },
    update: { note },
    create: { userId: req.user.id, date, note },
    include: logInclude,
  })

  res.json({ entry: serializeEntry(date, entry) })
})

router.post('/:date/prime-favourites', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })

  const existing = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    include: logInclude,
  })
  if (existing) return res.json({ entry: serializeEntry(date, existing), primed: false })

  const favourites = await prisma.product.findMany({
    where: { userId: req.user.id, favourite: true, status: 'ACTIVE' },
  })

  // Favourites default to the locked-in AM/PM order (nulls last, then insertion order),
  // so a freshly primed day reflects whatever routine order was last confirmed.
  const byOrder = (key) => (a, b) => {
    if (a[key] === b[key]) return a.dateAdded - b.dateAdded
    if (a[key] == null) return 1
    if (b[key] == null) return -1
    return a[key] - b[key]
  }
  const amFavourites = favourites.filter((p) => p.timeOfDay === 'AM' || p.timeOfDay === 'BOTH').sort(byOrder('amOrder'))
  const pmFavourites = favourites.filter((p) => p.timeOfDay === 'PM' || p.timeOfDay === 'BOTH').sort(byOrder('pmOrder'))

  const logsToCreate = [
    ...amFavourites.map((product, i) => ({ productId: product.id, period: 'AM', order: i })),
    ...pmFavourites.map((product, i) => ({ productId: product.id, period: 'PM', order: i })),
  ]

  const entry = await prisma.diaryEntry.create({
    data: {
      userId: req.user.id,
      date,
      logs: { create: logsToCreate },
    },
    include: logInclude,
  })

  res.json({ entry: serializeEntry(date, entry), primed: true })
})

router.post('/:date/log', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })
  const { productId, period } = req.body || {}
  if (period !== 'AM' && period !== 'PM') return res.status(400).json({ error: 'Period must be AM or PM.' })

  const product = await prisma.product.findFirst({ where: { id: productId, userId: req.user.id } })
  if (!product) return res.status(404).json({ error: 'Product not found.' })

  const entry = await prisma.diaryEntry.upsert({
    where: { userId_date: { userId: req.user.id, date } },
    update: {},
    create: { userId: req.user.id, date },
  })

  const lastLog = await prisma.diaryProductLog.findFirst({
    where: { diaryEntryId: entry.id, period },
    orderBy: { order: 'desc' },
  })
  const nextOrder = lastLog ? lastLog.order + 1 : 0

  await prisma.diaryProductLog.upsert({
    where: { diaryEntryId_productId_period: { diaryEntryId: entry.id, productId, period } },
    update: {},
    create: { diaryEntryId: entry.id, productId, period, order: nextOrder },
  })

  const full = await prisma.diaryEntry.findUnique({ where: { id: entry.id }, include: logInclude })
  res.status(201).json({ entry: serializeEntry(date, full) })
})

// Reorders a single day's AM or PM list only - never touches other days or
// the products' default order, so substituting/reordering one day doesn't
// ripple into the past or future.
router.put('/:date/log/reorder', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })
  const { period, logIds } = req.body || {}
  if (period !== 'AM' && period !== 'PM') return res.status(400).json({ error: 'Period must be AM or PM.' })
  if (!Array.isArray(logIds) || logIds.length === 0) return res.status(400).json({ error: 'logIds must be a non-empty array.' })

  const entry = await prisma.diaryEntry.findUnique({ where: { userId_date: { userId: req.user.id, date } } })
  if (!entry) return res.status(404).json({ error: 'No diary entry for this date.' })

  const logs = await prisma.diaryProductLog.findMany({ where: { diaryEntryId: entry.id, period } })
  const validIds = new Set(logs.map((l) => l.id))
  if (logIds.length !== logs.length || !logIds.every((id) => validIds.has(id))) {
    return res.status(400).json({ error: 'logIds must match the full set of logs for that day and period.' })
  }

  await prisma.$transaction(logIds.map((id, i) => prisma.diaryProductLog.update({ where: { id }, data: { order: i } })))

  const full = await prisma.diaryEntry.findUnique({ where: { id: entry.id }, include: logInclude })
  res.json({ entry: serializeEntry(date, full) })
})

router.delete('/:date/log', async (req, res) => {
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })
  const { productId, period } = req.query

  const entry = await prisma.diaryEntry.findUnique({ where: { userId_date: { userId: req.user.id, date } } })
  if (!entry) return res.status(204).end()

  await prisma.diaryProductLog.deleteMany({
    where: { diaryEntryId: entry.id, productId: String(productId), period: String(period) },
  })

  const full = await prisma.diaryEntry.findUnique({ where: { id: entry.id }, include: logInclude })
  res.json({ entry: serializeEntry(date, full) })
})

const STRONG_ACTIVE_KEYS = new Set(CURATED_INGREDIENTS.filter((i) => i.group === 'strong-active').map((i) => i.key))

// Ground truth for the review call - the model narrates these, it never
// decides on its own which actives conflict.
function strongActivePairsToday(products) {
  const byKey = new Map()
  for (const product of products) {
    for (const tag of product.ingredientTags || []) {
      if (STRONG_ACTIVE_KEYS.has(tag.key) && !byKey.has(tag.key)) byKey.set(tag.key, tag.label)
    }
  }
  const keys = [...byKey.keys()]
  const pairs = []
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) pairs.push(`${byKey.get(keys[i])} + ${byKey.get(keys[j])}`)
  }
  return pairs
}

function describeProduct(p) {
  const tags = (p.ingredientTags || [])
    .map((t) => t.label + (t.ewgConcern ? ` (possible concern: ${t.ewgConcern})` : ''))
    .join(', ')
  const name = `${p.brand ? `${p.brand} ` : ''}${p.name}`
  return tags ? `${name} — tagged: ${tags}` : name
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    pairing: { type: ['string', 'null'] },
    tomorrow: { type: 'string' },
  },
  required: ['summary', 'pairing', 'tomorrow'],
  additionalProperties: false,
}

const REVIEW_SYSTEM_PROMPT = `You write a short, warm daily skincare routine review for a personal skincare diary app. You're given the products logged today, each with any ingredients already tagged on it, any active-ingredient pairs already confirmed to be overlapping today (treat this as ground truth - never second-guess it or invent additional pairs that weren't given), and the user's own note about today, if they wrote one.

Return three fields:
- "summary": one short, plain sentence describing today's routine - what kind of products or standout actives were used. Encouraging, not clinical.
- "pairing": if overlapping active pairs were given, one short plain-language sentence about it, framed as a gentle heads-up, not a warning of certain harm. If no pairs were given, set this to null - never invent a concern that wasn't in the given data.
- "tomorrow": one short, practical sentence of advice for tomorrow's routine, informed by today's routine and, if given, how the user's skin felt today.

If the user's note mentions irritation, breakouts, or anything uncomfortable, let that soften your tone and shape the "tomorrow" advice accordingly. Never invent ingredient effects, hazards, or product details that weren't given to you - only comment on what's actually in the provided data. This is supportive guidance, not medical advice.`

// Manually triggered only - never generated automatically, so a routine that
// repeats day to day doesn't rack up a review nobody asked for.
router.post('/:date/review', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'Routine review is not configured on this server.' })
  }
  const date = parseDateOnly(req.params.date)
  if (!date) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })

  const entry = await prisma.diaryEntry.findUnique({
    where: { userId_date: { userId: req.user.id, date } },
    include: logInclude,
  })
  const products = [...new Map((entry?.logs || []).map((l) => [l.product.id, l.product])).values()]
  if (products.length === 0) return res.status(400).json({ error: "Nothing logged for this day yet." })

  const am = (entry.logs || []).filter((l) => l.period === 'AM').map((l) => l.product)
  const pm = (entry.logs || []).filter((l) => l.period === 'PM').map((l) => l.product)
  const pairs = strongActivePairsToday(products)

  const userContent = [
    `Morning products: ${am.length ? am.map(describeProduct).join('; ') : 'none logged'}`,
    `Evening products: ${pm.length ? pm.map(describeProduct).join('; ') : 'none logged'}`,
    `Confirmed overlapping actives used today: ${pairs.length ? pairs.join(', ') : 'none'}`,
    entry.note ? `The user's own note about today: "${entry.note}"` : `No note written today.`,
  ].join('\n')

  try {
    const anthropic = new Anthropic()
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 4000,
      thinking: { type: 'adaptive' },
      output_config: { format: { type: 'json_schema', schema: REVIEW_SCHEMA }, effort: 'medium' },
      system: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
    const response = await stream.finalMessage()

    if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: "Couldn't generate a review right now. Try again in a moment." })
    }
    const textBlocks = response.content.filter((block) => block.type === 'text')
    const finalText = textBlocks[textBlocks.length - 1]?.text
    if (!finalText) return res.status(502).json({ error: 'No result from the review.' })

    let parsed
    try {
      parsed = JSON.parse(finalText)
    } catch {
      console.error('Routine review returned unparseable JSON:', finalText)
      return res.status(502).json({ error: 'Got an unreadable result. Try again.' })
    }

    const updated = await prisma.diaryEntry.update({
      where: { id: entry.id },
      data: {
        routineReviewSummary: parsed.summary,
        routineReviewPairing: parsed.pairing || null,
        routineReviewTomorrow: parsed.tomorrow,
        routineReviewGeneratedAt: new Date(),
        routineReviewSignature: reviewSignature(products, entry.note),
      },
      include: logInclude,
    })
    res.json({ entry: serializeEntry(date, updated) })
  } catch (err) {
    console.error('Routine review failed:', err)
    res.status(502).json({ error: 'Could not generate a review right now. Try again in a moment.' })
  }
})

export default router
