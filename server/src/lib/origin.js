import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

// Mirrors the same check app.js uses to decide whether the server is also
// serving the built client (a single-service deploy, e.g. Replit) versus
// running standalone behind a separate Vite dev server (local dev).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const isUnifiedDeployment = fs.existsSync(path.join(__dirname, '../../../client/dist'))

function requestOrigin(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol
  const host = req.headers['x-forwarded-host'] || req.get('host')
  return `${proto}://${host}`
}

// In a unified deploy, the API and the client are the same origin, so unless
// someone explicitly overrides it, the right URL is just "wherever this
// request came in on" - no manual SERVER_URL/CLIENT_URL setup required.
export function resolveServerUrl(req) {
  if (process.env.SERVER_URL) return process.env.SERVER_URL
  if (isUnifiedDeployment) return requestOrigin(req)
  return `http://localhost:${process.env.PORT || 3001}`
}

export function resolveClientUrl(req) {
  if (process.env.CLIENT_URL) return process.env.CLIENT_URL
  if (isUnifiedDeployment) return requestOrigin(req)
  return 'http://localhost:5173'
}
