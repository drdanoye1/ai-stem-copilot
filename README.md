# AI Mathematics Copilot™

An AI-powered mathematics learning platform for students from Pre-K through PhD level. Built as a monorepo with a Next.js frontend, FastAPI backend, and PostgreSQL database.

---

## Infrastructure Overview

| Layer | Technology | URL | Purpose |
|---|---|---|---|
| **Frontend** | Next.js 14 / Vercel | https://math-copilot.vercel.app | User interface — all pages and interactions |
| **Backend** | FastAPI / Railway | https://ai-maths-copilot-backend-production.up.railway.app | API server — auth, AI calls, business logic |
| **Database** | PostgreSQL / Neon | `ep-steep-resonance-at467do3` | Persistent storage — users, sessions, progress, evidence, mastery |

### How the three services connect

```
User Browser
    │
    ▼
Vercel (Frontend — Next.js)
    │  HTTP requests to /api/v1/...
    ▼
Railway (Backend — FastAPI)
    │  SQL queries
    ▼
Neon (Database — PostgreSQL)
```

---

## ⚠️ Deployment — read this before pushing anything

**Vercel and Railway do NOT deploy the same way.** This has caused real confusion before — follow this exactly:

| | Frontend (Vercel) | Backend (Railway) |
|---|---|---|
| **Trigger** | Automatic, on every `git push origin master` | **Manual only** — `railway up` from `backend/` |
| **Source of truth** | Whatever is in the `master` branch on GitHub | Whatever is currently on disk in your local `backend/` folder — **does not read from git at all** |
| **If you forget** | N/A — you can't forget, it's automatic | Backend changes stay invisible in production even after `git push` succeeds. The commit exists on GitHub; the running server just never received it. |

**The rule going forward:** any time you change a file under `backend/`, you must run `railway up` yourself — a `git push` alone will never update the live backend. Conversely, any time you change a file under `apps/math-copilot/`, `git push origin master` is enough on its own; you do not need to run `vercel deploy` unless you specifically want a preview/manual build outside the normal flow.

A safe full-deploy sequence after any change touching both sides:
```bash
# 1. Commit + push (this alone updates the frontend)
git add <files>
git commit -m "..."
git push origin master

# 2. Separately, deploy the backend (git push does NOT do this)
cd backend
railway up
```

**A second trap to know about:** if a new frontend page imports something from `apps/math-copilot/src/lib/api.ts` (a type, a new API client method) that hasn't been committed yet, the Vercel build will fail with a TypeScript error even though the page file itself is committed. When adding a new page that calls a new backend endpoint, always commit `api.ts`'s additions in the *same* push as the page that uses them.

---

## Service Roles

### Vercel — Frontend Host
- Hosts the Next.js application as a globally distributed static + serverless site
- Auto-deploys on every `git push` to `master` (or via `npx vercel deploy --prod`)
- Serves all user-facing pages: login, dashboard, solve, explore, practice, theory, goals, outcomes, etc.
- Does **not** run Python, does **not** talk to the database directly
- Production URL: `https://math-copilot.vercel.app`

### Railway — Backend Host
- Runs the FastAPI Python server in a Docker container
- Handles: authentication (JWT), AI model calls (OpenAI / Anthropic / Gemini), session logging, evidence/mastery computation
- Reads/writes to the Neon database
- Deploy command: `railway up` from the `backend/` folder — **does not trigger from git push**, see the deployment warning above
- Project: `ai-maths-copilot-backend` → service: `ai-maths-copilot-backend`
- Production URL: `https://ai-maths-copilot-backend-production.up.railway.app`

### Neon — Database
- Managed serverless PostgreSQL (no server to maintain, scales to zero)
- Stores: users, math sessions, mentor conversations, project submissions, topic progress, learning goals, evidence events, mastery insight snapshots
- Connection string in Railway environment variables as `DATABASE_URL`
- Direct connection for seed/migration scripts: `postgresql+asyncpg://neondb_owner:...@ep-steep-resonance-at467do3...`
- **Migrations are never automatic** — see "Database Migrations" below. A migration script must be run manually from a machine with network access to Neon (this does not include any cloud sandbox used to write the code — always run migrations from your own machine).

---

## Repository Structure

```
AI-STEM-COPILOT/
├── apps/
│   └── math-copilot/          # Next.js 14 frontend
│       ├── src/app/
│       │   ├── (app)/         # Protected dashboard pages
│       │   │   ├── solve/         Solve a math problem
│       │   │   ├── explore/       Explore concepts with AI
│       │   │   ├── practice/      Practice problems + Check My Work (Part II)
│       │   │   ├── theory/        Theory & objectives
│       │   │   ├── scenario/      Scenario Intelligence™
│       │   │   ├── mentor/        AI Mentor (chat)
│       │   │   ├── data-explorer/ Live data + AI analysis
│       │   │   ├── projects/      Community projects
│       │   │   ├── digital-twin/  Digital Twin simulations
│       │   │   ├── lab/           Virtual Math Lab
│       │   │   ├── ar-lab/        AR/WebXR Lab (Algebra, Calculus, Coordinate Space, Geometry, Probability, Trigonometry)
│       │   │   ├── goals/         My Goals — Part I, Learning Goals & Objectives (NEW)
│       │   │   ├── outcomes/      Academic Outcomes Dashboard — Part III (NEW)
│       │   │   ├── onboarding/    Profile/curriculum/career onboarding wizard
│       │   │   ├── progress/      My Progress (incl. Mastery tab — Part II)
│       │   │   ├── saved/         Saved Outputs
│       │   │   ├── profile/       User Profile
│       │   │   ├── pricing/       Pricing Plans
│       │   │   └── parent/        Parent / Teacher Dashboard (links to Academic Outcomes — Part III)
│       │   └── (auth)/        # Public auth pages
│       │       ├── login/
│       │       └── register/
│       ├── src/components/
│       │   ├── goals/         GoalsPanel.tsx — "Your Goals for This Experience" (Part I)
│       │   ├── ar-vr/         AR/VR shared components
│       │   ├── GroupedSelect.tsx
│       │   └── Sidebar.tsx    Nav — includes My Goals + Academic Outcomes entries
│       ├── src/lib/
│       │   ├── api.ts             All API client methods — see the deployment warning above before adding new ones
│       │   ├── personalization-taxonomy.ts
│       │   └── ar-vr/
│       └── .env.local             Frontend environment variables
│
├── backend/                   # FastAPI Python backend
│   ├── app/
│   │   ├── routers/
│   │   │   ├── auth.py        Register, login, /me, Google OAuth
│   │   │   ├── math.py        Solve, explore, practice, theory, scenario (+ evidence logging — Part II)
│   │   │   ├── mentor.py      AI Mentor conversation (+ evidence logging — Part II)
│   │   │   ├── ar_vr.py       AR/VR interpretation layer (+ evidence logging — Part II)
│   │   │   ├── data.py        World Bank, IMF, NASA, WHO data proxy
│   │   │   ├── projects.py    Community project submissions
│   │   │   ├── goals.py       Learning Goals & Objectives Engine — Part I (NEW)
│   │   │   └── outcomes.py    Practice Check, mastery, evidence, dashboard, AI insights — Parts II + III (NEW)
│   │   ├── models/
│   │   │   ├── user.py        User, UserRole, EducationLevel
│   │   │   ├── session.py     MathSession, UserTopicProgress
│   │   │   ├── mentor.py      MentorConversation
│   │   │   ├── project.py     Project, ProjectSubmission
│   │   │   ├── learning_goals.py  LearningPlan, LearningGoal — Part I (NEW)
│   │   │   ├── evidence.py    EvidenceEvent, PracticeProblem, PracticeAttempt — Part II (NEW)
│   │   │   └── insight.py     MasteryInsightSnapshot — Part III (NEW)
│   │   ├── services/
│   │   │   ├── personalization.py         AI Personalization Context Engine™
│   │   │   ├── curriculum_registry.py     Curriculum → AI-calibration text
│   │   │   ├── career_competency_registry.py  Career Mathematics Competency Registry™ — Part I (NEW)
│   │   │   ├── learning_goals_engine.py   AI Learning Goals & Objectives Engine™ — Part I (NEW)
│   │   │   ├── evidence_engine.py         log_evidence_event, compute_mastery, compute_career_competency_summary, compute_evidence_trends — Parts II + III (NEW)
│   │   │   ├── grading.py                 Two-tier Practice Check answer grading — Part II (NEW)
│   │   │   └── insight_engine.py          AI Insights & Next Steps™ — cached, guardrailed narrative generation — Part III (NEW)
│   │   ├── config.py          Settings (reads from .env)
│   │   ├── database.py        SQLAlchemy async engine
│   │   └── main.py            FastAPI app, CORS, router registration, model imports
│   ├── migrations/             Plain-SQL migrations 002–009 — see "Database Migrations" below
│   ├── run_migration_00N.py    One script per migration — run manually, see below
│   ├── .env                   Backend environment variables (not committed)
│   ├── requirements.txt       Python dependencies
│   ├── Dockerfile             Railway build config
│   ├── seed_admin.py          Create/reset admin account in Neon
│   └── check_neon.py          Inspect Neon DB tables and users
│
└── README.md
```

---

## The Personalized Learning Goals, Academic Outcomes, Mastery & Career Readiness Framework (v4.0)

Three sequential parts, each gated on the previous one being complete. Full design rationale and v1 scope decisions for each part are documented separately (build records); this is the quick-reference summary so future work doesn't have to rediscover it by trial and error.

### Part I — Personalized Learning Goals, Objectives & Outcomes Plan™
Answers: *what should the learner learn and demonstrate?*
- Backend: `backend/app/models/learning_goals.py` (`LearningPlan`, `LearningGoal`), `backend/app/services/career_competency_registry.py`, `backend/app/services/learning_goals_engine.py`, `backend/app/routers/goals.py` (`POST /goals/generate`, `GET /goals/active`)
- Frontend: `apps/math-copilot/src/app/(app)/goals/page.tsx`, `apps/math-copilot/src/components/goals/GoalsPanel.tsx` ("Your Goals for This Experience" panel — shipped on Explore/Practice/Solve/Theory/Mentor)
- Migration: `007_add_learning_goals.sql`
- Auto-generates a plan on onboarding completion; learner can manually regenerate from `/goals`.

### Part II — Academic Outcomes, Mastery & Competency Measurement Framework™
Answers: *what has the learner actually demonstrated?*
- Backend: `backend/app/models/evidence.py` (`EvidenceEvent`, `PracticeProblem`, `PracticeAttempt`), `backend/app/services/evidence_engine.py` (`log_evidence_event`, `compute_mastery`, `compute_career_competency_summary`), `backend/app/services/grading.py`, `backend/app/routers/outcomes.py` (`POST /outcomes/practice/structured`, `POST /outcomes/practice/{id}/submit`, `GET /outcomes/mastery`, `GET /outcomes/evidence`)
- Evidence logging wired into `math.py` (solve/explore/theory), `mentor.py` (respond), `ar_vr.py` (interpret) as passive "exposure" events; "Practice Check" is the platform's first real answer-checking flow
- Frontend: "Check My Work" section on `/practice`, "Mastery" tab on `/progress`
- Migration: `008_add_evidence_outcomes.sql`
- Mastery states: `Not Yet Demonstrated → Emerging → Developing → Proficient → Mastered`, computed fresh from evidence on every read — never cached, never a manufactured percentage.

### Part III — Academic Outcomes / Mastery Dashboard™
Answers: *where is the learner now, and what's next?*
- Backend: `backend/app/models/insight.py` (`MasteryInsightSnapshot`), `backend/app/services/insight_engine.py` (`get_or_generate_insight` — cached, fingerprinted AI narrative with a two-layer guardrail against inventing percentages/scores), `compute_evidence_trends()` appended to `evidence_engine.py`, `GET /outcomes/dashboard`, `POST /outcomes/insights` in `outcomes.py`
- Frontend: `apps/math-copilot/src/app/(app)/outcomes/page.tsx` — per-topic mastery cards, career competency rollup, weekly evidence trend chart, AI Insights & Next Steps™ panel; nav entry in `Sidebar.tsx`; cross-links from `/progress`'s Mastery tab and `/parent`'s learner lookup (`?learner_email=` query param — reuses `/parent`'s existing lookup UI rather than a duplicate form)
- Migration: `009_add_mastery_insights.sql`
- **Never invents a mastery percentage, Bloom level, or readiness score** — it only visualizes/interprets exactly what Part II already computed. The AI narrative is regex-scanned for a literal `%` before being trusted; on any violation or failure it falls back to a deterministic, zero-AI template built directly from the mastery data.

**Still open:** Gate 4 — closing the loop so mastery data / AI Insights feed back into `/goals/generate` for the next round of personalized goals. Not yet built.

---

## Database Migrations

All migrations are plain SQL (`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`) with a matching `run_migration_00N.py` runner using direct `asyncpg`. **None of these run automatically** — Railway does not run migrations on deploy. Run each one manually, in order, from a machine with network access to Neon:

```bash
cd backend
python run_migration_002.py   # personalization fields
python run_migration_003.py   # missing pre_k value fix
python run_migration_004.py   # college education level
python run_migration_005.py   # grade/year field
python run_migration_006.py   # curriculum + onboarding fields
python run_migration_007.py   # learning_plans, learning_goals — Part I
python run_migration_008.py   # evidence_events, practice_problems, practice_attempts — Part II
python run_migration_009.py   # mastery_insight_snapshots — Part III
```

If you add a new migration, follow the same pattern: `backend/migrations/0NN_description.sql` + `backend/run_migration_0NN.py` mirroring the previous script's `DATABASE_URL`/SSL boilerplate, and add a line to this list.

---

## Environment Variables

### Backend (`backend/.env`) — also set in Railway Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `SECRET_KEY` | JWT signing key |
| `ALGORITHM` | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Token lifetime (e.g. `10080` = 7 days) |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GOOGLE_API_KEY` | Google Gemini API key |
| `DEFAULT_MODEL` | Default AI model (e.g. `gpt-4o`) |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `ADMIN_PASSWORD` | Default admin password (used by `/auth/setup`) |
| `APP_ENV` | `production` or `development` |

### Frontend (`apps/math-copilot/.env.local`) — also set in Vercel Environment Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL — `https://ai-maths-copilot-backend-production.up.railway.app/api/v1` |
| `NEXTAUTH_SECRET` | NextAuth signing secret |
| `NEXTAUTH_URL` | Frontend URL — `https://math-copilot.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |

---

## User Roles

| Role | Access |
|---|---|
| `student` | Default role. Access to all learning pages, own data only. |
| `parent` | Can look up a specific learner's data via `/parent` and `/outcomes?learner_email=`, same as `teacher`/`admin`. |
| `teacher` | Same cross-learner lookup access as `parent`. |
| `admin` | Full access including admin panel. Auto-assigned to emails in `ADMIN_EMAILS`. |

Admin account: `admin@aimathcopilot.com`

Cross-learner role check (used by `/math/parent-summary` and mirrored exactly by `/outcomes`'s `_resolve_target_user`): if the requested `learner_email` isn't found, or the viewer's role isn't `admin`/`teacher`/`parent`, the response silently falls back to the viewer's own data — never an error.

---

## Education Levels

Pre-K · Elementary · Middle School · High School · Undergraduate · Graduate · PhD · Professional

---

## Deployment

### Deploy Backend (Railway)
```bash
cd backend
railway login       # first time only
railway link        # select: ai-maths-copilot-backend → production
railway up
```
**Reminder:** this reads the current state of your local `backend/` folder, not git. Run it after every backend change, committed or not.

### Deploy Frontend (Vercel)
```bash
git push origin master
```
Auto-deploys on push. Manual deploy (rarely needed) from the repo root:
```bash
cd apps/math-copilot
npx vercel deploy --prod
```
Vercel's project root is set to `apps/math-copilot`.

### Reset / Create Admin Account
```bash
cd backend
python seed_admin.py
```

### Inspect Neon Database
```bash
cd backend
python check_neon.py
```

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| GET | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/setup` | Create first admin (one-time) |
| POST | `/api/v1/auth/oauth/google` | Google OAuth sync |
| POST | `/api/v1/math/solve` | Solve a problem |
| POST | `/api/v1/math/explore` | Explore a concept |
| POST | `/api/v1/math/practice` | Generate practice problems |
| POST | `/api/v1/math/theory` | Theory & learning objectives |
| POST | `/api/v1/math/scenario` | Scenario Intelligence™ |
| GET | `/api/v1/math/parent-summary` | Cross-learner activity summary (role-gated) |
| POST | `/api/v1/mentor/start` | Start mentor session |
| POST | `/api/v1/mentor/respond` | Continue mentor conversation |
| GET | `/api/v1/data/worldbank` | World Bank data proxy |
| GET | `/api/v1/data/imf` | IMF data proxy |
| GET | `/api/v1/data/nasa` | NASA POWER data proxy |
| GET | `/api/v1/data/who` | WHO data proxy |
| GET | `/api/v1/projects/` | List community projects |
| POST | `/api/v1/projects/submit` | Submit project for AI feedback |
| POST | `/api/v1/goals/generate` | Generate a personalized learning plan — Part I |
| GET | `/api/v1/goals/active` | Get the learner's active learning plan — Part I |
| POST | `/api/v1/outcomes/practice/structured` | Generate a Check My Work practice set — Part II |
| POST | `/api/v1/outcomes/practice/{id}/submit` | Submit + grade a Practice Check answer — Part II |
| GET | `/api/v1/outcomes/mastery` | Per-topic mastery + career competency summary — Part II (accepts `learner_email`) |
| GET | `/api/v1/outcomes/evidence` | Evidence Portfolio™ for a subject/topic — Part II (accepts `learner_email`) |
| GET | `/api/v1/outcomes/dashboard` | Full Academic Outcomes Dashboard payload — Part III (accepts `learner_email`) |
| POST | `/api/v1/outcomes/insights` | AI Insights & Next Steps™ narrative — Part III (accepts `learner_email`, `force`) |
