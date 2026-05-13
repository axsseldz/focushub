# FocusHub

Productivity app with two modes: **Reading** (available) and **Writing** (coming soon).
Per-user accounts via **Clerk**. Each signed-in user has their own private
library and reading analytics. Monorepo with a Next.js frontend and a FastAPI
backend.

## Structure

```
app/
├── frontend/   # Next.js 16.2, React 19, TypeScript, Tailwind v4, Clerk
└── backend/    # FastAPI, SQLAlchemy, SQLite (database.db)
```

## Commands

### Checks (CI)

```bash
make check          # run all checks (frontend + backend)
make check-frontend # lint, type-check, build
make check-backend  # lint (ruff), tests (pytest), import check
```

### Frontend

```bash
cd frontend
npm install
npm run dev         # http://localhost:3000
npm run lint
npm run type-check
npm run build
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload  # http://localhost:8000
```

## Architecture

**Frontend** — Next.js App Router, `src/app/` for pages, `src/components/` for components (grouped by feature: `dashboard/`, `reading-mode/`, `analytics/`). Tailwind v4 for styling, GSAP for animations, `pdfjs-dist` + `react-pdf` for PDF rendering, `@mediapipe/tasks-vision` for gesture detection (WASM loaded from CDN at runtime, not bundled).

**Backend** — FastAPI app in `backend/app/`. SQLite DB at `backend/database.db`. Routes in `backend/app/routes/`. Models use SQLAlchemy mapped columns; schemas use Pydantic.

**Auth** — Clerk (`@clerk/nextjs`) handles sign-up, sign-in and session state. The landing page (`/`) is the public entry point with modal sign-in and sign-up. `clerkMiddleware()` lives in `frontend/src/proxy.ts` and protects `/dashboard`, `/lectura`, and `/analitica`. After signing in, users land on `/dashboard`. After signing out, they land on `/` (`afterSignOutUrl` is set on `<ClerkProvider>`).

**Frontend → Backend** — REST API. CORS configured for `localhost:3000`. Backend runs on port 8000. Every backend request includes an `X-User-Id` header (Clerk user ID); the backend uses `require_user_id` to scope each query. `sendBeacon` (page-unload flushes from the reading tracker) cannot set headers, so the backend also accepts `?user_id=` as a fallback for that one path.

## Authentication

- Public route: `/` (landing — modal sign-in / sign-up via Clerk).
- Protected routes: `/dashboard`, `/lectura`, `/analitica`.
- Sign-in/sign-up are launched via `<SignInButton mode="modal">` / `<SignUpButton mode="modal">` on the landing page, so there are no `/sign-in` or `/sign-up` pages.
- The dashboard, analytics and reading-mode headers each render `<UserButton />` for session menu / sign-out.
- All Clerk components use Spanish via `@clerk/localizations`' `esES` locale.

### Required env vars (`frontend/.env.local`)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard

NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=...
```

## Backend conventions

- New routes go in `backend/app/routes/` and must be registered in `backend/app/main.py`
- SQLAlchemy models in `backend/app/models.py`, Pydantic schemas in `backend/app/schemas.py`
- DB migrations are handled manually in `ensure_database_schema()` in `database.py`
- The backend venv lives at `backend/.venv` — always activate before running Python commands
- Per-user scoping — any route reading user-owned data must inject `user_id: str = Depends(require_user_id)` (from `app/auth.py`) and filter all queries with `Model.user_id == user_id`. Pre-Clerk rows are tagged `user_id = "legacy"` by the migration in `ensure_database_schema()` and are effectively orphaned.

## Frontend conventions

- Pages in `src/app/<route>/page.tsx` (App Router)
- Components are client-side by default (`"use client"`); add `async` + remove the directive for server components
- Spanish UI — all user-facing strings are in Spanish (including Clerk UI via `esES`)
- Tailwind v4 (not v3) — no `tailwind.config.js`, config is in CSS
- Backend calls go through `useAuthedFetch()` from `src/lib/api.ts`, which injects the `X-User-Id` header. Always gate the call on `useAuth().isLoaded && isSignedIn` so we don't fire an unauth'd request during hydration.
