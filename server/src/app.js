import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import diaryRoutes from './routes/diary.js'
import ingredientRoutes from './routes/ingredients.js'
import { requireAuth } from './middleware/auth.js'

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())
app.use(cookieParser())

app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRoutes)
app.use('/api/products', requireAuth, productRoutes)
app.use('/api/diary', requireAuth, diaryRoutes)
app.use('/api/ingredients', requireAuth, ingredientRoutes)

app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Something went wrong.' })
})

export default app
