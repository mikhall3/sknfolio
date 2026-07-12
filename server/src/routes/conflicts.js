import { Router } from 'express'
import { prisma } from '../db.js'

const router = Router()

function normalizePair(a, b) {
  const keyA = String(a || '').trim()
  const keyB = String(b || '').trim()
  return keyA < keyB ? [keyA, keyB] : [keyB, keyA]
}

router.get('/', async (req, res) => {
  const acknowledgements = await prisma.conflictAcknowledgement.findMany({
    where: { userId: req.user.id },
    orderBy: { acknowledgedAt: 'desc' },
  })
  res.json({ acknowledgements })
})

router.post('/', async (req, res) => {
  const [ingredientA, ingredientB] = normalizePair(req.body?.ingredientA, req.body?.ingredientB)
  if (!ingredientA || !ingredientB) {
    return res.status(400).json({ error: 'Both ingredient keys are required.' })
  }

  const acknowledgement = await prisma.conflictAcknowledgement.upsert({
    where: { userId_ingredientA_ingredientB: { userId: req.user.id, ingredientA, ingredientB } },
    update: {},
    create: { userId: req.user.id, ingredientA, ingredientB },
  })
  res.status(201).json({ acknowledgement })
})

router.delete('/:id', async (req, res) => {
  await prisma.conflictAcknowledgement.deleteMany({ where: { id: req.params.id, userId: req.user.id } })
  res.status(204).end()
})

export default router
