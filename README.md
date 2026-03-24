# App Setup

- `backend`: FastAPI API
- `frontend`: Next.js app

## Requirements

- Python 3.12 or compatible
- Node.js 20 or newer
- npm

## Backend

### 1. Go to the backend folder

```bash
cd backend
```

### 2. Create a virtual environment

```bash
python3 -m venv .venv
```

### 3. Activate the virtual environment

macOS/Linux:

```bash
source .venv/bin/activate
```

Windows PowerShell:

```powershell
.venv\Scripts\Activate.ps1
```

### 4. Install dependencies

```bash
pip install -r requirements.txt
```

### 5. Run the backend

```bash
uvicorn main:app --reload
```

The backend will run at:

`http://127.0.0.1:8000`

## Frontend

### 1. Go to the frontend folder

```bash
cd frontend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the frontend

```bash
npm run dev
```

The frontend will run at:

`http://localhost:3000`

## Running Both

Use two terminals:

1. Start the backend from `backend/`
2. Start the frontend from `frontend/`
