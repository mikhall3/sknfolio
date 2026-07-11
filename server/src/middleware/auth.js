import { prisma } from '../db.js'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'sknfolio_session'

// While testing solo, SKIP_AUTH bypasses sign-in entirely and every request
// acts as this one fixed user - no login page, no magic links. Unset it (or
// set to anything other than "true") to restore normal auth.
const SKIP_AUTH = process.env.SKIP_AUTH === 'true'
const DEV_USER_EMAIL = process.env.DEV_USER_EMAIL || 'dev@sknfolio.local'

export async function requireAuth(req, res, next) {
  if (SKIP_AUTH) {
    req.user = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL },
    })
    return next()
  }

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
