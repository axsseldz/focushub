# FocusHub

Productivity app with two modes: **Reading** (available) and **Writing** (coming soon). Monorepo with a Next.js frontend and a FastAPI backend.

## Structure

```
app/
├── frontend/   # Next.js 16.2, React 19, TypeScript, Tailwind v4
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

**Frontend** — Next.js App Router, `src/app/` for pages, `src/components/` for components (grouped by feature: `dashboard/`, `reading-mode/`). Tailwind v4 for styling, GSAP for animations, `pdfjs-dist` + `react-pdf` for PDF rendering, `@mediapipe/tasks-vision` for gesture detection (WASM loaded from CDN at runtime, not bundled).

**Backend** — FastAPI app in `backend/app/`. SQLite DB at `backend/database.db`. Routes in `backend/app/routes/`. Models use SQLAlchemy mapped columns; schemas use Pydantic.

**Frontend → Backend** — REST API. CORS configured for `localhost:3000`. Backend runs on port 8000.

## Backend conventions

- New routes go in `backend/app/routes/` and must be registered in `backend/app/main.py`
- SQLAlchemy models in `backend/app/models.py`, Pydantic schemas in `backend/app/schemas.py`
- DB migrations are handled manually in `ensure_database_schema()` in `database.py`
- The backend venv lives at `backend/.venv` — always activate before running Python commands

## Frontend conventions

- Pages in `src/app/<route>/page.tsx` (App Router)
- Components are client-side by default (`"use client"`); add `async` + remove the directive for server components
- Spanish UI — all user-facing strings are in Spanish
- Tailwind v4 (not v3) — no `tailwind.config.js`, config is in CSS
