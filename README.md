# Juru Performance Review Platform

Full-stack web platform replacing Asana + Google Sheets for Juru's semi-annual and annual performance reviews.

---

## Quick Start

### 1. Prerequisites
- Node.js 18+, pnpm, Docker Desktop

### 2. Start infrastructure
```bash
docker compose up -d
```
This starts PostgreSQL (port 5432), Redis (6379), MinIO (9000/9001).

### 3. Configure environment
```bash
cp .env.example .env
```
Fill in:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console (OAuth 2.0)
- `GOOGLE_CALLBACK_URL` — `http://localhost:3001/api/v1/auth/google/callback`
- `JWT_SECRET` — any long random string
- `SMTP_USER` / `SMTP_PASS` — Gmail app password for noreply@juru.org
- `GCHAT_WEBHOOK_URL` — Google Chat space webhook URL

### 4. Install dependencies
```bash
pnpm install
```

### 5. Run database migrations + seed
```bash
pnpm db:migrate    # runs Prisma migrations
pnpm db:seed       # inserts sample BU, teams, employees
```

Or from the db package directly:
```bash
cd packages/db
node_modules/.bin/prisma migrate dev
node_modules/.bin/tsx src/seed.ts
```

### 6. Start development servers
```bash
pnpm dev
```
- Frontend: http://localhost:3000
- API:      http://localhost:3001
- MinIO:    http://localhost:9001 (minioadmin / minioadmin)

---

## Google OAuth Setup

1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorised redirect URI: `http://localhost:3001/api/v1/auth/google/callback`
4. Copy Client ID and Secret to `.env`

---

## Architecture

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 · Tailwind CSS · TanStack Query · Recharts |
| API | Fastify 4 · TypeScript · Prisma ORM |
| Background | BullMQ · node-cron |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Storage | MinIO (S3-compatible) |
| Auth | Google OAuth 2.0 · JWT |

## User Roles & Portals

| Role | Portal |
|---|---|
| Employee | `/employee` — self-appraisal + result |
| Evaluator | `/evaluator` — score assigned employees |
| HR Admin | `/hr` — cycle management, matrix upload, releases |
| Team Head | `/analytics/interviews` — interview notes |
| BU Head / MD | `/analytics` — distribution, risk, nominations |

## Scoring Logic

```
weighted_score  = (E1_score × 0.70) + (E2_score × 0.30)
overall_average = SUM(weighted_scores[1..10]) / 10

≥ 4.5 → Exceptional
≥ 3.5 → Exceeds Expectations
≥ 2.5 → Meets Expectations
≥ 1.5 → Partially Meets
 < 1.5 → Below Expectations

Nomination: avg ≥ 4.0
```

## At-Risk Rules

| Level | Grades | Threshold |
|---|---|---|
| Entry | E1–E4, C1–C4, S1–S4, I | >3 sub-criteria Below |
| Mid | SE1–SE4, SC1–SC4 | >2 sub-criteria Below |
| Senior | PE, PC, M, SM, D, MD | >1 sub-criterion Below |

---

## Project Structure

```
juru-platform/
├── apps/
│   ├── api/            # Fastify REST API
│   │   └── src/
│   │       ├── routes/ # auth, cycles, employees, assignments, submissions, results, reports
│   │       ├── services/ # scoring, reports, notify
│   │       └── jobs/   # BullMQ workers + cron scheduler
│   └── web/            # Next.js frontend
│       └── src/app/
│           ├── login/        # Google OAuth login
│           ├── employee/     # Self-appraisal + result
│           ├── evaluator/    # Scoring interface
│           ├── hr/           # Cycles, employees, reports
│           ├── analytics/    # Distribution, risk, nominations, heatmap
│           └── notifications/ # In-app notification feed
└── packages/
    └── db/             # Prisma schema + generated client
```
