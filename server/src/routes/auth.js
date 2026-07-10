import { Router } from 'express'
import { prisma } from '../db.js'
import { generateToken } from '../lib/tokens.js'
import { sendMagicLinkEmail } from '../lib/mailer.js'
import { COOKIE_NAME, requireAuth } from '../middleware/auth.js'
import { resolveServerUrl, resolveClientUrl } from '../lib/origin.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SESSION_TTL_MS = (Number(process.env.SESSION_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000
const MAGIC_LINK_TTL_MS = (Number(process.env.MAGIC_LINK_TTL_MINUTES) || 15) * 60 * 1000

router.post('/request-link', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  })

  const token = generateToken()
  await prisma.magicLink.create({
    data: {
      token,
      userId: user.id,
      expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
    },
  })

  const url = `${resolveServerUrl(req)}/api/auth/verify?token=${token}`
  await sendMagicLinkEmail(email, url)

  const devLink = process.env.NODE_ENV === 'production' ? undefined : url
  res.json({ ok: true, devLink })
})

router.get('/verify', async (req, res) => {
  const token = String(req.query?.token || '')
  const clientUrl = resolveClientUrl(req)

  const magicLink = await prisma.magicLink.findUnique({ where: { token } })
  if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
    return res.redirect(`${clientUrl}/login?error=expired`)
  }

  await prisma.magicLink.update({
    where: { id: magicLink.id },
    data: { usedAt: new Date() },
  })

  const sessionToken = generateToken()
  await prisma.session.create({
    data: {
      token: sessionToken,
      userId: magicLink.userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })

  res.cookie(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS,
  })

  res.redirect(clientUrl)
})

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: { id: req.user.id, email: req.user.email } })
})

router.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME]
  if (token) {
    await prisma.session.deleteMany({ where: { token } })
  }
  res.clearCookie(COOKIE_NAME)
  res.json({ ok: true })
})

export default router
