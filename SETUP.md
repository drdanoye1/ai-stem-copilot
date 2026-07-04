# AI STEM Copilot™ — Setup & Deployment Guide

## Prerequisites

- Node.js 18+
- Python 3.11+
- Git
- Railway CLI (`npm install -g @railway/cli`)
- Vercel CLI (`npm install -g vercel`)

---

## 1. Git Init & First Commit

```powershell
cd "C:\Users\drdanoye\My_AI_Projects\SaaS_Apps\prompt-engineering-marketplace\Prompt Engineering Marketplace\ai-stem-copilot"

git init
git add .
git commit -m "feat: AI Mathematics Copilot MVP — initial commit"
```

Then create a repo on GitHub (e.g. `ai-stem-copilot`) and push:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/ai-stem-copilot.git
git push -u origin master
```

---

## 2. Install Frontend Dependencies

From the monorepo root:

```powershell
npm install
```

This installs all workspaces: `apps/math-copilot` and `packages/ui`.

---

## 3. Backend Setup (Railway)

### Create Railway project

```powershell
cd backend
railway login
railway init        # creates new project
railway add         # add PostgreSQL addon → select "PostgreSQL"
```

### Set environment variables in Railway dashboard

Go to Railway → your project → Variables, add:

| Variable | Value |
|---|---|
| `DATABASE_URL` | (auto-set by Railway PostgreSQL addon) |
| `SECRET_KEY` | (generate: `python -c "import secrets; print(secrets.token_hex(32))"`) |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `10080` |
| `OPENAI_API_KEY` | `sk-...` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GOOGLE_API_KEY` | `AIza...` |
| `DEFAULT_MODEL` | `gpt-4o` |
| `APP_ENV` | `production` |
| `FRONTEND_URL` | `https://math-copilot.vercel.app` (update after Vercel deploy) |

### Deploy backend

```powershell
cd backend
railway up
```

Note the Railway backend URL (e.g. `https://ai-stem-copilot-backend.up.railway.app`).

---

## 4. Frontend Setup (.env)

Create `apps/math-copilot/.env.local`:

```
NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-BACKEND.up.railway.app/api/v1
```

For local development use:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

---

## 5. Run Locally

**Terminal 1 — Backend:**
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```powershell
# From monorepo root
npm run dev --workspace=apps/math-copilot
# Runs on http://localhost:3001
```

> If port 3001 conflicts, set `PORT=3002` or pass `-- -p 3002`.

---

## 6. Deploy Frontend to Vercel

```powershell
cd apps/math-copilot
vercel
```

When prompted:
- **Root directory**: leave blank (already in `apps/math-copilot`)
- **Framework**: Next.js
- **Build command**: `next build`
- **Output directory**: `.next`

Add environment variable in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = `https://YOUR-RAILWAY-BACKEND.up.railway.app/api/v1`

Then update `FRONTEND_URL` in Railway to the Vercel URL.

---

## 7. Deploy Promptivia Page-Count Selector Changes

```powershell
cd "C:\Users\drdanoye\My_AI_Projects\SaaS_Apps\prompt-engineering-marketplace\Prompt Engineering Marketplace"

# Remove any lingering git lock
Remove-Item ".git\index.lock" -Force -ErrorAction SilentlyContinue

git add frontend/src/app/(dashboard)/org/library/page.tsx
git add backend/app/routers/execution.py
git add frontend/src/lib/api.ts
git commit -m "feat: add page-count selector (5/10/15/20 pages) and fix Railway proxy timeout"
git push origin master

# Deploy backend
cd backend
railway up
```

---

## Monorepo Structure

```
ai-stem-copilot/
├── apps/
│   └── math-copilot/          # Next.js 14 frontend (port 3001)
│       └── src/
│           ├── app/
│           │   ├── page.tsx               # Landing page
│           │   ├── (auth)/login           # Login
│           │   ├── (auth)/register        # Register
│           │   └── (app)/
│           │       ├── dashboard          # Home dashboard
│           │       ├── solve              # AI Math Solver ⭐
│           │       ├── explore            # Topic Explorer
│           │       ├── practice           # Practice Problems
│           │       └── progress           # Progress tracking
│           ├── components/
│           │   ├── Sidebar.tsx            # Navigation
│           │   └── MathOutput.tsx         # LaTeX renderer
│           ├── lib/api.ts                 # Axios + typed API client
│           └── store/auth.ts             # Zustand auth store
├── backend/                   # FastAPI (port 8000)
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models/
│       │   ├── user.py        # User, UserRole, EducationLevel
│       │   └── session.py     # MathSession, UserTopicProgress
│       └── routers/
│           ├── auth.py        # JWT register/login
│           └── math.py        # solve/explore/practice/history/progress
└── packages/
    └── ui/                    # Shared @ai-stem/ui package
```

---

## Adding Physics / Chemistry / Biology / Engineering Copilots

Each new copilot is a new Next.js app in `apps/`:

```powershell
# Copy math-copilot as a starting template
cp -r apps/math-copilot apps/physics-copilot

# Update package.json name
# Update tailwind.config.js brand colors (e.g. cyan for physics)
# Update backend math.py subjects/prompts for physics
# Deploy as separate Vercel project with same Railway backend
```

The shared Railway backend serves all copilots — just add new router files per subject.
