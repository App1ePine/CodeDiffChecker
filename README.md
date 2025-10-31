# Code Diff Checker

An online, shareable diffing workspace built with Vue 3, Element Plus, and `@git-diff-view`, backed by a Hono + MariaDB API for registration, authentication, and share management.

## Features
- Paste or type code on two panes and preview unified or split diffs with syntax highlighting.
- Register/login to keep persistent sessions via secure HTTP-only cookies.
- Authenticated users can create share links, set visibility, define expiration, and delete or edit shares later.
- Public share pages render diffs read-only with the same viewing controls.

## Repository layout
- `src/` – Vue 3 frontend powered by Rsbuild.
- `server/` – Hono-based REST API (TypeScript) with MariaDB storage.
- `server/migrations/` – SQL migrations for MariaDB schema.

## Getting started

### 1. Install dependencies
```bash
yarn install
```

### 2. Configure environment variables

#### Frontend (`.env.*` at repo root)
The repo ships `.env.development` (used by `yarn dev`) and `.env.production` (used by `yarn build --env-mode production`/`yarn preview`). Both expose the same browser-visible variable:

```ini
PUBLIC_API_BASE_URL=http://localhost:4000  # API origin the frontend should call
```
Point it at your API server; if the frontend and backend share an origin you can omit it. Rsbuild only injects variables prefixed with `PUBLIC_`, so keep that prefix when adding new client-side flags. You can create `.env.local` to override values without committing them.

#### Backend (`server/.env.*`)
Server configs live alongside the API source. Copy `server/.env.example` to the mode-specific file you need (e.g. `server/.env.development`, `server/.env.production`, or `server/.env.local`) and update the fields for your MariaDB instance and deployment details:

```ini
NODE_ENV=development
PORT=4000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=code_diff_checker
DB_USER=cdc_user
DB_PASSWORD=replace-me
JWT_SECRET=replace-with-strong-secret
TOKEN_EXPIRES_IN=7d
FRONTEND_ORIGIN=http://localhost:3001
SHARE_BASE_URL=http://localhost:3001
```
Production builds follow the same shape—just swap in your real secrets, database credentials, and public origins.

### 3. Prepare the database
1. Create the database/user in MariaDB if needed.
2. Run the SQL migrations:
   ```bash
   yarn db:migrate
   ```

### 4. Run locally
Use two terminals during development:

```bash
# Terminal 1 – API server (Hono)
yarn server:dev

# Terminal 2 – Vue dev server (Rsbuild)
yarn dev
```

- Frontend defaults to http://localhost:3001
- API server defaults to http://localhost:4000

### 5. Build for production
```bash
# Frontend assets
yarn build

# API (transpile to server/dist)
yarn server:build
```
Start the API in production with:
```bash
yarn server:start
```

## API overview
All endpoints live under `/api`.

- `POST /api/auth/register` – create an account and receive a session cookie.
- `POST /api/auth/login` – login with email/password.
- `POST /api/auth/logout` – destroy the session cookie.
- `GET /api/auth/me` – fetch the currently authenticated user.
- `POST /api/shares` – create a share (authenticated).
- `GET /api/shares` – list shares owned by the logged-in user.
- `PATCH /api/shares/:id` – update title, visibility, or expiration.
- `DELETE /api/shares/:id` – delete a share.
- `GET /api/public/shares/:slug` – fetch a public share by slug; respects hidden/expired flags.

All authenticated routes rely on the HttpOnly cookie issued by login/register.

## Notes
- The frontend fetch helper always sends `credentials: 'include'` so cookies work across origins (ensure CORS settings match your deployment).
- Generated share URLs use `SHARE_BASE_URL` to build absolute links; set it to your public frontend origin when deploying.
- Clipboard copy helpers gracefully fail if the browser blocks clipboard access.

Happy diffing!
