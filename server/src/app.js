import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import diaryRoutes from './routes/diary.js'
import ingredientRoutes from './routes/ingredients.js'
import insightsRoutes from './routes/insights.js'
import checkinRoutes from './routes/checkins.js'
import abnormalityRoutes from './routes/abnormalities.js'
import conflictRoutes from './routes/conflicts.js'
import { requireAuth } from './middleware/auth.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (req, res) => res.json({ ok: true }))

// Safety net: if an old or malformed magic link ever points at /auth/verify
// instead of /api/auth/verify (missing the API prefix), forward it rather
// than 404ing - the token itself is still valid either way.
app.get('/auth/verify', (req, res) => {
  const query = req.originalUrl.split('?')[1]
  res.redirect(`/api/auth/verify${query ? `?${query}` : ''}`)
})

app.use('/api/auth', authRoutes)
app.use('/api/products', requireAuth, productRoutes)
app.use('/api/diary', requireAuth, diaryRoutes)
app.use('/api/ingredients', requireAuth, ingredientRoutes)
app.use('/api/insights', requireAuth, insightsRoutes)
app.use('/api/checkins', requireAuth, checkinRoutes)
app.use('/api/abnormalities', requireAuth, abnormalityRoutes)
app.use('/api/conflicts', requireAuth, conflictRoutes)

// In production (a single deployed service, e.g. Replit) the server also
// serves the built client, so the whole app lives behind one origin/port.
// In local dev the client runs its own Vite server instead, so this is a
// no-op there since client/dist won't exist.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.join(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

export default app
