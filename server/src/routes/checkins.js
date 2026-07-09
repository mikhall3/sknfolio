import { Router } from 'express'
import { prisma } from '../db.js'
import { parseDateOnly, startOfWeek } from '../lib/dates.js'
import { Feeling } from '../generated/prisma/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const checkins = await prisma.checkin.findMany({
    where: { userId: req.user.id },
    orderBy: { weekOf: 'desc' },
    take: 26,
  })
  res.json({ checkins })
})

router.post('/', async (req, res) => {
  const today = parseDateOnly(req.body?.today)
  if (!today) return res.status(400).json({ error: 'Invalid today, expected YYYY-MM-DD.' })

  const { feeling, note } = req.body || {}
  if (!Feeling[feeling]) return res.status(400).json({ error: 'Feeling must be GREAT, OKAY, or ROUGH.' })

  const weekOf = startOfWeek(today)
  const checkin = await prisma.checkin.upsert({
    where: { userId_weekOf: { userId: req.user.id, weekOf } },
    update: { feeling, note: note ? String(note).trim() : null },
    create: { userId: req.user.id, weekOf, feeling, note: note ? String(note).trim() : null },
  })

  res.json({ checkin })
})

export default router
