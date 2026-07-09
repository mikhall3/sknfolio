import { prisma } from '../db.js'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sknfolio_session'

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Not signed in.' })

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  })

  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {})
    res.clearCookie(COOKIE_NAME)
    return res.status(401).json({ error: 'Session expired.' })
  }

  req.user = session.user
  next()
}

export { COOKIE_NAME }
