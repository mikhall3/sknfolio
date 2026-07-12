import { Router } from 'express'
import { prisma } from '../db.js'
import { parseDateOnly, formatDateOnly } from '../lib/dates.js'

const router = Router()

const logInclude = {
  logs: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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

export default router
