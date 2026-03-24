# App

Repo with:

- `frontend`: Next.js
- `backend`: FastAPI

## Requirements

- Node.js 20+
- npm
- Python 3.11+

## Setup

| Command                                                                                               | Description                                        |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `cd frontend && npm install`                                                                          | Install frontend dependencies                      |
| `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt` | Create backend virtualenv and install dependencies |

## Run

| Command                                                                | Description                                   |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `cd frontend && npm run dev`                                           | Start the frontend on `http://localhost:3000` |
| `cd backend && source .venv/bin/activate && uvicorn main:app --reload` | Start the backend on `http://127.0.0.1:8000`  |

## Checks

Run these from the repo root.

| Command               | Description                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- |
| `make check`          | Run all frontend and backend checks                                                    |
| `make check-frontend` | Run frontend install, lint, type-check, tests if present, and build                    |
| `make check-backend`  | Run backend venv setup, install, lint if available, tests if present, and import check |

## Recommended Flow

1. Make your changes.
2. Run `make check`.
3. Commit and push if it passes.
