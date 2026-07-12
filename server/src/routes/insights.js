import { Router } from 'express'
import { prisma } from '../db.js'
import { parseDateOnly, formatDateOnly, addDays, startOfWeek } from '../lib/dates.js'

const router = Router()

const logInclude = {
  logs: {
    include: {
      product: { include: { ingredientTags: true } },
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
  return { date: formatDateOnly(date), note: entry?.note || '', am, pm }
}

router.get('/', async (req, res) => {
  const today = parseDateOnly(req.query.today)
  if (!today) return res.status(400).json({ error: 'Invalid today, expected YYYY-MM-DD.' })

  const rangeStart = addDays(today, -6)

  // Last 7 days: only ever real logged history, never a projection of favourites.
  const entries = await prisma.diaryEntry.findMany({
    where: { userId: req.user.id, date: { gte: rangeStart, lte: today } },
    include: logInclude,
  })
  const entryByDate = new Map(entries.map((e) => [formatDateOnly(e.date), e]))
  const last7Days = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(rangeStart, i)
    last7Days.push(serializeEntry(date, entryByDate.get(formatDateOnly(date))))
  }

  // Streak: consecutive days with any real content (a log or a note), walking
  // back from today. If today has nothing yet, it doesn't break the streak,
  // it just isn't counted until something is logged.
  const contentEntries = await prisma.diaryEntry.findMany({
    where: { userId: req.user.id, date: { lte: today } },
    select: { date: true, note: true, _count: { select: { logs: true } } },
    orderBy: { date: 'desc' },
    take: 400,
  })
  const contentDates = new Set(
    contentEntries.filter((e) => (e.note && e.note.trim()) || e._count.logs > 0).map((e) => formatDateOnly(e.date))
  )
  const hasLoggedToday = contentDates.has(formatDateOnly(today))
  let cursor = hasLoggedToday ? today : addDays(today, -1)
  let streakCount = 0
  while (contentDates.has(formatDateOnly(cursor))) {
    streakCount++
    cursor = addDays(cursor, -1)
  }

  // Weekly check-in status, plus recent history so progress over time is visible,
  // not just the current week.
  const weekOf = startOfWeek(today)
  const checkin = await prisma.checkin.findUnique({
    where: { userId_weekOf: { userId: req.user.id, weekOf } },
  })
  const history = await prisma.checkin.findMany({
    where: { userId: req.user.id, weekOf: { lt: weekOf } },
    orderBy: { weekOf: 'desc' },
    take: 8,
  })

  res.json({
    last7Days,
    streak: { count: streakCount, hasLoggedToday },
    checkin: {
      weekOf: formatDateOnly(weekOf),
      current: checkin,
      history: history.map((c) => ({ weekOf: formatDateOnly(c.weekOf), feeling: c.feeling, note: c.note })),
    },
  })
})

export default router
