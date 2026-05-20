# FocusHub

Productivity app with two working modes, both live:

- **Reading** (`/lectura`) — a private PDF library + distraction-free reader
  with optional AI narration ("audiolibro") and gesture page-turning.
- **Workspace** (`/workspace`) — a LaTeX editor co-written with an AI copilot
  ("The Architect"), compiled to real PDFs via Tectonic, with uploadable
  assets and a per-project chat history.

Per-user accounts via **Clerk** — each signed-in user has their own private
library, workspace projects, and analytics. **Analytics** (`/analitica`)
combines *both* modes: it charts active reading time and active workspace
time side by side (streaks, daily goal, heatmap, achievements). Monorepo
with a Next.js frontend and a FastAPI backend.

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

**Frontend** — Next.js App Router, `src/app/` for pages, `src/components/` for components (grouped by feature: `landing/`, `reading-mode/`, `workspace/`, `analytics/`, `dashboard/`). Note `dashboard/` is **shared chrome** (the `Sidebar`), not a `/dashboard` route — there is no dashboard page. Styling/animation stack: Tailwind v4, GSAP (ambient backdrops, landing hero) + `framer-motion` (component motion), `recharts` (analytics charts), `canvas-confetti` (celebration bursts), `pdfjs-dist` + `react-pdf` (PDF rendering), `@monaco-editor/react` + `katex` (LaTeX editor / preview), `@mediapipe/tasks-vision` (gesture detection, WASM loaded from CDN at runtime, not bundled).

**Backend** — FastAPI app in `backend/app/`. SQLite DB at `backend/database.db`. Routes in `backend/app/routes/` (`files`, `sessions`, `workspace`, `workspace_sessions`, `audio`). Models use SQLAlchemy mapped columns; schemas use Pydantic. External tools: **OpenAI** (`openai_client.py`, the workspace chat copilot), **ElevenLabs** (`routes/audio.py`, reader narration, cached on disk), and the **Tectonic** binary (`latex_compile.py`, LaTeX→PDF — must be on the backend's `PATH`, e.g. `brew install tectonic`).

**Auth** — Clerk (`@clerk/nextjs`) handles sign-up, sign-in and session state. The landing page (`/`) is the public entry point with modal sign-in and sign-up. `clerkMiddleware()` lives in `frontend/src/proxy.ts` and protects `/lectura`, `/analitica`, and `/workspace`. The landing CTAs set `fallbackRedirectUrl="/workspace"`, so users land on `/workspace` after signing in. After signing out, they land on `/` (`afterSignOutUrl` is set on `<ClerkProvider>`).

**Frontend → Backend** — REST API. CORS configured for `localhost:3000`. Backend runs on port 8000. Every backend request includes an `X-User-Id` header (Clerk user ID); the backend uses `require_user_id` to scope each query. `sendBeacon` (page-unload flushes from the activity trackers) cannot set headers, so the backend also accepts `?user_id=` as a fallback for the `POST /sessions` and `POST /workspace-sessions` paths.

## Authentication

- Public route: `/` (landing — modal sign-in / sign-up via Clerk).
- Protected routes: `/lectura`, `/analitica`, `/workspace` (enforced in `src/proxy.ts`).
- Sign-in/sign-up are launched via `<SignInButton mode="modal">` / `<SignUpButton mode="modal">` on the landing page, so there are no `/sign-in` or `/sign-up` pages. Both set `fallbackRedirectUrl="/workspace"`.
- The reading-mode, workspace, and analytics headers each render `<UserButton />` for session menu / sign-out.
- All Clerk components use Spanish via `@clerk/localizations`' `esES` locale.

### Required env vars

`frontend/.env.local` (also read by the backend — see `backend/app/settings.py`):

```
# Clerk + frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

NEXT_PUBLIC_CLERK_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/workspace
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/workspace

NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY=...

# Backend secrets (settings.py loads this file at import time)
OPENAI_API_KEY=sk-...              # workspace chat copilot
# OPENAI_MODEL_PLAN / OPENAI_MODEL_EXECUTE override the gpt-4o-mini default
ELEVENLABS_API_KEY=...             # reader narration (audiolibro)
ELEVENLABS_VOICE_ID_ROUS=...
ELEVENLABS_VOICE_ID_DIEGO=...
```

`backend/.env` is optional and, if present, overrides values from `frontend/.env.local`.

## Data model (`backend/app/models.py`)

- `File` — a user's uploaded PDF (the reading library). Workspace exports also land here (see sync-to-library) so they show up next to books.
- `ReadingSession` — one active-reading session (book_id, start/end, `duration_seconds`). `book_id` is a plain int, not an FK; the files DELETE route cleans up matching sessions.
- `ReadingProgress` — per-`(user, book)` auto-bookmark (last page + last narrated paragraph), upserted with debounce.
- `WorkspaceProject` — a LaTeX project (`latex_source` blob, `last_exported_file_id`).
- `WorkspaceAsset` — an image/doc uploaded to a project (PDFs get `text_excerpt` pre-extracted for chat context). Cascades on project delete.
- `WorkspaceMessage` — one chat turn (`role`, `mode` = plan/execute, `content`). Cascades on project delete.
- `WorkspaceSession` — one active-workspace session, mirroring `ReadingSession` (project_id plain int; cleaned up by the project DELETE route).
- `AudioCache` — on-disk ElevenLabs narration cache keyed by SHA-256 of (text + voice).

## Time tracking & analytics

- Two parallel client trackers live in `frontend/src/lib/`: `reading-tracker.ts` (mounted by the PDF reader) and `workspace-tracker.ts` (mounted by `WorkspaceClient`). Both count **active** time only, gated by three conditions that must all hold: presence (tab visible + focused), recent interaction (mouse/keys within 45 s), and a recent mode-specific "proof of work" (reading → page-turn/scroll; workspace → typing/save/compile/asset upload within 3 min). Sessions < 5 s are dropped; failed flushes queue in `localStorage` and replay later; page-unload flushes use `sendBeacon` with `?user_id=`.
- Sessions POST to `/sessions` (reading) and `/workspace-sessions` (workspace).
- `/analitica` (`components/analytics/`) loads both session streams plus `/files` and `/workspace/projects` for titles, then buckets them client-side in local TZ (`lib/analytics.ts`). The dual buckets feed: `MetricHero` (today + streak + total), `GoalRing` (daily-goal ring split reading/workspace), `MinutesBarChart` (stacked), `HeatmapCalendar`, `AchievementsBoard` (6 milestones), `TrackingExplainer` (dropdown explaining both modes), and `RecentSessionsList` (merged feed). The daily goal lives in `localStorage`, namespaced per user.
- The landing page's central animation is `components/landing/LandingShowcase.tsx` — a 4-scene auto-cycling demo (reading, writing, tracking, achievements) ending in a `canvas-confetti` burst.

## Workspace specifics

- Chat is streamed over **SSE** (`POST /workspace/projects/{id}/chat`); the client reads it with `lib/sse.ts`. "Plan" mode replies in prose; "Execute" mode rewrites `latex_source` and the client recompiles.
- PDF compile: `GET /workspace/projects/{id}/pdf` runs Tectonic (cached by content hash) and streams the PDF; the canvas shows the tectonic log tail on compile errors.
- Sync to library: `POST /workspace/projects/{id}/sync-to-library` compiles and stores the PDF as a base64 `data:` URL in `files`, so the export appears in `/lectura`.

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
