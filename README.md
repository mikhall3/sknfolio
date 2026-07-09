# SKNFOLIO

A diary for your face — log what you actually used, morning and evening, and let it build into a real history of your routine.

## Stack

- **Client**: React + Vite, Tailwind CSS v4, lucide-react
- **Server**: Express + Prisma + PostgreSQL
- **Auth**: passwordless magic-link email sign-in, session cookies

## Project layout

```
client/   Vite React app
server/   Express API + Prisma schema/migrations
```

## Local setup

### 1. Database

Requires a running PostgreSQL instance. If you have Postgres installed locally:

```bash
createdb sknfolio
```

### 2. Server

```bash
cd server
cp .env.example .env   # if starting fresh; otherwise edit .env directly
npm install
npx prisma migrate dev
npm run dev             # http://localhost:3001
```

Env vars of note (see `.env`):

- `DATABASE_URL` — Postgres connection string.
- `SMTP_*` — optional. If left blank, magic links are logged to the server console instead of emailed, and `POST /api/auth/request-link` also returns a `devLink` field in non-production so you can sign in without any email setup.
- `ANTHROPIC_API_KEY` — required once the ingredient-detection feature is enabled (server-side only, never sent to the client).

### 3. Client

```bash
cd client
npm install
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api/*` to `http://localhost:3001`.

## Data & privacy

Each person signs in with their own email and gets a private account — there's no shared data between users. Everything lives in Postgres on the server, so it syncs across every device you sign into, unlike a purely local/offline version of this app.
