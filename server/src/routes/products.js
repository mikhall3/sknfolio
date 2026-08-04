import { Router } from 'express'
import { prisma } from '../db.js'
import { Category, TimeOfDay, IngredientConfidence } from '../generated/prisma/index.js'

const router = Router()

function validateIngredients(ingredients) {
  if (ingredients === undefined) return []
  if (!Array.isArray(ingredients)) return null
  const clean = []
  for (const tag of ingredients) {
    const key = String(tag?.key || '').trim()
    const label = String(tag?.label || '').trim()
    if (!key || !label) return null
    const confidence = tag?.confidence && IngredientConfidence[tag.confidence] ? tag.confidence : null
    const source = tag?.source === 'ai' ? 'ai' : 'manual'
    const verified = tag?.verified === false ? false : true
    const ewgConcern = tag?.ewgConcern ? String(tag.ewgConcern).trim().slice(0, 300) : null
    clean.push({ key, label, confidence, source, verified, ewgConcern })
  }
  return clean
}

const productInclude = {
  ingredientTags: true,
  notes: { orderBy: { date: 'desc' } },
}

router.get('/', async (req, res) => {
  const status = req.query.status
  const where = { userId: req.user.id }
  if (status === 'ACTIVE' || status === 'ARCHIVED') where.status = status

  const products = await prisma.product.findMany({
    where,
    include: productInclude,
    orderBy: [{ favourite: 'desc' }, { category: 'asc' }, { name: 'asc' }],
  })
  res.json({ products })
})

router.post('/', async (req, res) => {
  const { brand, name, category, timeOfDay, favourite, ingredients } = req.body || {}

  const cleanName = String(name || '').trim()
  if (!cleanName) return res.status(400).json({ error: 'Name is required.' })
  const cleanBrand = brand ? String(brand).trim() : null
  if (!Category[category]) return res.status(400).json({ error: 'Invalid category.' })
  const tod = TimeOfDay[timeOfDay] ? timeOfDay : 'BOTH'
  const cleanIngredients = validateIngredients(ingredients)
  if (cleanIngredients === null) return res.status(400).json({ error: 'Invalid ingredients.' })

  const product = await prisma.product.create({
    data: {
      userId: req.user.id,
      brand: cleanBrand || null,
      name: cleanName,
      category,
      timeOfDay: tod,
      favourite: Boolean(favourite),
      ingredientTags: { create: cleanIngredients },
    },
    include: productInclude,
  })
  res.status(201).json({ product })
})

// Locks in a day's product sequence as the new default AM/PM order, so future
// days start with it - today's and past days' already-stored log order is untouched.
router.post('/reorder', async (req, res) => {
  const { period, productIds } = req.body || {}
  if (period !== 'AM' && period !== 'PM') return res.status(400).json({ error: 'Period must be AM or PM.' })
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds must be a non-empty array.' })
  }

  const owned = await prisma.product.findMany({ where: { id: { in: productIds }, userId: req.user.id } })
  if (owned.length !== productIds.length) return res.status(404).json({ error: 'One or more products not found.' })

  const field = period === 'AM' ? 'amOrder' : 'pmOrder'
  await prisma.$transaction(
    productIds.map((id, i) => prisma.product.update({ where: { id }, data: { [field]: i } }))
  )

  res.status(204).end()
})

router.get('/:id', async (req, res) => {
  const product = await prisma.product.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: productInclude,
  })
  if (!product) return res.status(404).json({ error: 'Product not found.' })
  res.json({ product })
})

router.patch('/:id', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })

  const data = {}
  const { brand, name, category, timeOfDay, favourite } = req.body || {}

  if (brand !== undefined) data.brand = brand ? String(brand).trim() || null : null
  if (name !== undefined) {
    const cleanName = String(name).trim()
    if (!cleanName) return res.status(400).json({ error: 'Name cannot be empty.' })
    data.name = cleanName
  }
  if (category !== undefined) {
    if (!Category[category]) return res.status(400).json({ error: 'Invalid category.' })
    data.category = category
  }
  if (timeOfDay !== undefined) {
    if (!TimeOfDay[timeOfDay]) return res.status(400).json({ error: 'Invalid time of day.' })
    data.timeOfDay = timeOfDay
  }
  if (favourite !== undefined) data.favourite = Boolean(favourite)

  const product = await prisma.product.update({
    where: { id: existing.id },
    data,
    include: productInclude,
  })
  res.json({ product })
})

const EMPTY_ACTIONS = {
  rebuy: 'REBOUGHT',
  replace: 'REPLACED',
  retire: 'RETIRED',
}

router.post('/:id/empty', async (req, res) => {
  const existing = await prisma.product.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: { ingredientTags: true },
  })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })
  if (existing.status !== 'ACTIVE') return res.status(400).json({ error: 'This product is already archived.' })

  const { rating, comment, action } = req.body || {}
  const retireReason = EMPTY_ACTIONS[action]
  if (!retireReason) return res.status(400).json({ error: 'Action must be rebuy, replace, or retire.' })

  // A rating only makes sense when there's an opinion behind it (rebuying or
  // replacing implies one) - "just archiving it" doesn't require rating it first.
  let cleanRating = null
  if (rating !== undefined && rating !== null && rating !== '') {
    cleanRating = Number(rating)
    if (!Number.isInteger(cleanRating) || cleanRating < 1 || cleanRating > 5) {
      return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' })
    }
  } else if (action !== 'retire') {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' })
  }
  const cleanComment = comment ? String(comment).trim().slice(0, 2000) : null

  const archivedProduct = await prisma.product.update({
    where: { id: existing.id },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      emptyRating: cleanRating,
      emptyComment: cleanComment,
      retireReason,
    },
    include: productInclude,
  })

  let rebought = null
  if (action === 'rebuy') {
    rebought = await prisma.product.create({
      data: {
        userId: req.user.id,
        brand: existing.brand,
        name: existing.name,
        category: existing.category,
        timeOfDay: existing.timeOfDay,
        favourite: existing.favourite,
        reboughtFromId: existing.id,
        ingredientTags: {
          create: existing.ingredientTags.map((tag) => ({
            key: tag.key,
            label: tag.label,
            confidence: tag.confidence,
            source: tag.source,
          })),
        },
      },
      include: productInclude,
    })
  }

  res.json({ product: archivedProduct, rebought })
})

router.delete('/:id', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })
  await prisma.product.delete({ where: { id: existing.id } })
  res.status(204).end()
})

router.post('/:id/ingredients', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })

  const key = String(req.body?.key || '').trim()
  const label = String(req.body?.label || '').trim()
  if (!key || !label) return res.status(400).json({ error: 'Ingredient key and label are required.' })
  const confidence = req.body?.confidence && IngredientConfidence[req.body.confidence] ? req.body.confidence : null
  const source = req.body?.source === 'ai' ? 'ai' : 'manual'
  const verified = req.body?.verified === false ? false : true
  const ewgConcern = req.body?.ewgConcern ? String(req.body.ewgConcern).trim().slice(0, 300) : null

  const already = await prisma.productIngredient.findFirst({ where: { productId: existing.id, key } })
  if (already) return res.status(409).json({ error: 'That ingredient is already tagged.' })

  const tag = await prisma.productIngredient.create({
    data: { productId: existing.id, key, label, confidence, source, verified, ewgConcern },
  })
  res.status(201).json({ ingredientTag: tag })
})

router.delete('/:id/ingredients/:tagId', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })
  await prisma.productIngredient.deleteMany({ where: { id: req.params.tagId, productId: existing.id } })
  res.status(204).end()
})

router.post('/:id/notes', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })

  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: 'Note text is required.' })
  const date = req.body?.date ? new Date(req.body.date) : new Date()

  const note = await prisma.productNote.create({
    data: { productId: existing.id, text, date },
  })
  res.status(201).json({ note })
})

router.delete('/:id/notes/:noteId', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })
  await prisma.productNote.deleteMany({ where: { id: req.params.noteId, productId: existing.id } })
  res.status(204).end()
})

export default router
