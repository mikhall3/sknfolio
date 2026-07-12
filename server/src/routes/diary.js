import { Router } from 'express'
import { prisma } from '../db.js'
import { parseDateOnly, formatDateOnly } from '../lib/dates.js'

const router = Router()

const logInclude = {
  logs: {
    include: {
      product: { include: { ingredientTags: true, notes: { orderBy: { date: 'desc' } } } },
    },
  },
}

function serializeEntry(date, entry) {
  const am = []
  const pm = []
  for (const log of entry?.logs || []) {
    const target = log.period === 'AM' ? am : pm
    target.push({ logId: log.id, product: log.product })
  }
  return {
    date: formatDateOnly(date),
    note: entry?.note || '',
    am,
    pm,
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

  const logsToCreate = []
  for (const product of favourites) {
    if (product.timeOfDay === 'AM' || product.timeOfDay === 'BOTH') {
      logsToCreate.push({ productId: product.id, period: 'AM' })
    }
    if (product.timeOfDay === 'PM' || product.timeOfDay === 'BOTH') {
      logsToCreate.push({ productId: product.id, period: 'PM' })
    }
  }

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

  await prisma.diaryProductLog.upsert({
    where: { diaryEntryId_productId_period: { diaryEntryId: entry.id, productId, period } },
    update: {},
    create: { diaryEntryId: entry.id, productId, period },
  })

  const full = await prisma.diaryEntry.findUnique({ where: { id: entry.id }, include: logInclude })
  res.status(201).json({ entry: serializeEntry(date, full) })
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

export default router
