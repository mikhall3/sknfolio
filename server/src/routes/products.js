import { Router } from 'express'
import { prisma } from '../db.js'
import { Category, TimeOfDay, IngredientConfidence } from '../generated/prisma/index.js'

const router = Router()

const VALID_FILL_LEVELS = [100, 75, 50, 25, 0]

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
    clean.push({ key, label, confidence, source })
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
  const { name, category, fillLevel, timeOfDay, favourite, ingredients } = req.body || {}

  const cleanName = String(name || '').trim()
  if (!cleanName) return res.status(400).json({ error: 'Name is required.' })
  if (!Category[category]) return res.status(400).json({ error: 'Invalid category.' })
  if (!VALID_FILL_LEVELS.includes(fillLevel)) return res.status(400).json({ error: 'Invalid fill level.' })
  const tod = TimeOfDay[timeOfDay] ? timeOfDay : 'BOTH'
  const cleanIngredients = validateIngredients(ingredients)
  if (cleanIngredients === null) return res.status(400).json({ error: 'Invalid ingredients.' })

  const product = await prisma.product.create({
    data: {
      userId: req.user.id,
      name: cleanName,
      category,
      fillLevel,
      timeOfDay: tod,
      favourite: Boolean(favourite),
      ingredientTags: { create: cleanIngredients },
    },
    include: productInclude,
  })
  res.status(201).json({ product })
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
  const { name, category, fillLevel, timeOfDay, favourite } = req.body || {}

  if (name !== undefined) {
    const cleanName = String(name).trim()
    if (!cleanName) return res.status(400).json({ error: 'Name cannot be empty.' })
    data.name = cleanName
  }
  if (category !== undefined) {
    if (!Category[category]) return res.status(400).json({ error: 'Invalid category.' })
    data.category = category
  }
  if (fillLevel !== undefined) {
    if (!VALID_FILL_LEVELS.includes(fillLevel)) return res.status(400).json({ error: 'Invalid fill level.' })
    data.fillLevel = fillLevel
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

router.delete('/:id', async (req, res) => {
  const existing = await prisma.product.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Product not found.' })
  await prisma.product.delete({ where: { id: existing.id } })
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
