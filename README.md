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

## Deploying (e.g. Replit)

The root `package.json` and `.replit` set this up to run as a single service: `npm start` installs both sub-projects, runs migrations, builds the client, and starts the server, which serves the built frontend itself alongside the API on one origin/port. Locally you still run `client` and `server` as two separate dev processes (above) — the unified path only kicks in when `client/dist` exists.

To deploy:

1. Import this repo (this branch) into your host of choice.
2. Provision a Postgres database and set `DATABASE_URL` as a secret/env var.
3. Set `CLIENT_URL` **and** leave `SERVER_URL` unset — both should resolve to your deployed app's public URL once you know it (you may need to deploy once, copy the assigned URL, then set `CLIENT_URL` to it and redeploy/restart).
4. Optionally set `ANTHROPIC_API_KEY` for ingredient detection and `SMTP_*` for real emails (without SMTP, magic links are logged to the server's console).
5. Run `npm start` (or let the host run it automatically).

## Data & privacy

Each person signs in with their own email and gets a private account — there's no shared data between users. Everything lives in Postgres on the server, so it syncs across every device you sign into, unlike a purely local/offline version of this app.
