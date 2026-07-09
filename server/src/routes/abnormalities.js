import { Router } from 'express'
import { prisma } from '../db.js'
import { parseDateOnly } from '../lib/dates.js'
import { AbnormalityType } from '../generated/prisma/index.js'

const router = Router()

router.get('/', async (req, res) => {
  const abnormalities = await prisma.abnormality.findMany({
    where: { userId: req.user.id },
    orderBy: { date: 'desc' },
    take: 100,
  })
  res.json({ abnormalities })
})

router.post('/', async (req, res) => {
  const { type, severity, note, date } = req.body || {}
  if (!AbnormalityType[type]) return res.status(400).json({ error: 'Invalid abnormality type.' })
  const cleanSeverity = Number(severity)
  if (!Number.isInteger(cleanSeverity) || cleanSeverity < 1 || cleanSeverity > 5) {
    return res.status(400).json({ error: 'Severity must be a whole number from 1 to 5.' })
  }
  const parsedDate = date ? parseDateOnly(date) : new Date()
  if (!parsedDate) return res.status(400).json({ error: 'Invalid date, expected YYYY-MM-DD.' })

  const abnormality = await prisma.abnormality.create({
    data: {
      userId: req.user.id,
      type,
      severity: cleanSeverity,
      note: note ? String(note).trim() : null,
      date: parsedDate,
    },
  })
  res.status(201).json({ abnormality })
})

router.delete('/:id', async (req, res) => {
  const existing = await prisma.abnormality.findFirst({ where: { id: req.params.id, userId: req.user.id } })
  if (!existing) return res.status(404).json({ error: 'Not found.' })
  await prisma.abnormality.delete({ where: { id: existing.id } })
  res.status(204).end()
})

export default router
