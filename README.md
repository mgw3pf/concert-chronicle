# Concert Chronicle

A self-hosted app for keeping a record of every show you've seen. Each concert is a ticket stub: date, lineup (headliner + openers), venue, rating, notes, and photos. Multi-user, with each person's catalog of artists and venues private to their account.

![Node 22+](https://img.shields.io/badge/node-%E2%89%A522.5-brightgreen) ![License: MIT](https://img.shields.io/badge/license-MIT-blue)

## Features

- **User accounts** — email/password registration, bcrypt hashing, JWT sessions in httpOnly cookies
- **Concert logging** — date, venue, ordered artist lineup, 1–5 rating, free-form notes
- **Artist & venue selection** — type-ahead search over your personal catalog with inline "Add new" creation, ranked by how often you've seen them
- **Photo uploads** — multiple photos per show; every upload is decoded and re-encoded server-side (EXIF-rotated, resized, thumbnailed), so phone HEICs become web-friendly JPEGs and disguised non-image files are rejected
- **Lifetime serials** — your first show ever is stub Nº 001

## Architecture

```
client/   React 18 + TypeScript + Vite SPA
server/   Express 4 (ESM JavaScript), REST API under /api
          node:sqlite  → single-file SQLite DB, zero native DB dependency
          sharp        → image re-encoding and thumbnails
          multer       → multipart upload handling
data/     SQLite database + uploaded photos (gitignored; a volume in production)
```

One process serves everything in production: the Express server hosts the API and the built SPA, so hosting is a single small container plus one persistent volume. In development, Vite proxies `/api` to the server so cookies stay first-party and no CORS setup is needed.

**Requirements:** Node 22.5+ (uses the built-in `node:sqlite` module).

## Local development

```bash
# Terminal 1 — API server on :3001
cd server
npm install
npm run dev

# Terminal 2 — Vite dev server on :5173 (proxies /api to :3001)
cd client
npm install
npm run dev
```

Open http://localhost:5173, create an account, and log a show.

Run the API test suite (covers auth, CRUD, ownership checks, and the full photo pipeline):

```bash
cd server && npm test
```

## Deployment

The design goal is *cheap and extensible*: one container, one volume, scale-to-zero where the platform supports it.

### Option A — Fly.io (recommended, ~$0–2/month)

A `fly.toml` is included, configured to stop the machine when idle and start it on request.

```bash
fly launch --no-deploy          # accept the bundled fly.toml
fly volumes create concert_data --size 1
fly secrets set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
fly deploy
```

### Option B — Any Docker host (Railway, Render, a $5 VPS)

```bash
cp .env.example .env            # fill in JWT_SECRET
docker compose up -d --build
```

The app listens on port 3001; put your platform's HTTPS proxy or a Caddy/nginx reverse proxy in front of it. All state lives in the `/data` volume — back that directory up and you've backed up everything.

### Production checklist

- Set a strong `JWT_SECRET` (the server refuses to start in production without one)
- Serve over HTTPS (the session cookie is marked `Secure` in production)
- Snapshot or back up the `/data` volume

## API overview

All routes are JSON under `/api`; everything except `/api/auth/*` and `/api/health` requires a session.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/login` · `/logout` | Account + session management |
| GET | `/api/auth/me` | Current user |
| GET/POST | `/api/artists` · `/api/venues` | Type-ahead search (`?q=`) and create-or-get |
| GET/POST | `/api/concerts` | List (newest first) and create |
| GET/PUT/DELETE | `/api/concerts/:id` | Read, update, delete one show |
| POST | `/api/concerts/:id/photos` | Multipart upload (field `photos`, ≤10 files, ≤10 MB each) |
| GET | `/api/photos/:id/file` · `/thumb` | Serve images (owner-only) |
| DELETE | `/api/photos/:id` | Remove a photo |

## Design notes & extension points

- **Database** — routes only touch `prepare().run/get/all` and a `transaction()` helper (`server/src/db.js`), so swapping SQLite for Postgres later is contained to one module. Schema changes go through the forward-only migration list in the same file.
- **Photo storage** — files live on the data volume today; to move to S3/R2, replace the disk reads/writes in `server/src/routes/photos.js` and store object keys instead of filenames.
- **Ideas that fit the schema as-is** — a stats page (most-seen artists, venues by count), setlist.fm import, a public share view, or map plotting of venues (add lat/lng columns via a new migration).

## License

MIT — see [LICENSE](LICENSE).
