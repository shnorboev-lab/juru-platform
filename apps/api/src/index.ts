import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import { startScheduler } from './jobs/scheduler.js'
import { authRoutes }        from './routes/auth.js'
import { cycleRoutes }       from './routes/cycles.js'
import { employeeRoutes }    from './routes/employees.js'
import { assignmentRoutes }  from './routes/assignments.js'
import { submissionRoutes }  from './routes/submissions.js'
import { resultRoutes }      from './routes/results.js'
import { reportRoutes }      from './routes/reports.js'
import { notificationRoutes } from './routes/notifications.js'

const app = Fastify({ logger: true })

// ── Plugins ────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  credentials: true,
})
await app.register(cookie)
await app.register(jwt, { secret: process.env.JWT_SECRET! })
await app.register(rateLimit, { max: 200, timeWindow: '1 minute' })
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10 MB

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))
app.get('/api/v1/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// ── Routes ─────────────────────────────────────────────────────────────────
await app.register(authRoutes,        { prefix: '/api/v1/auth' })
await app.register(cycleRoutes,       { prefix: '/api/v1/cycles' })
await app.register(employeeRoutes,    { prefix: '/api/v1/employees' })
await app.register(assignmentRoutes,  { prefix: '/api/v1/assignments' })
await app.register(submissionRoutes,  { prefix: '/api/v1/submissions' })
await app.register(resultRoutes,      { prefix: '/api/v1/results' })
await app.register(reportRoutes,      { prefix: '/api/v1/reports' })
await app.register(notificationRoutes, { prefix: '/api/v1/notifications' })

// ── Scheduler ──────────────────────────────────────────────────────────────
startScheduler()

// ── Start ──────────────────────────────────────────────────────────────────
const port = Number(process.env.API_PORT ?? 3001)
await app.listen({ port, host: '0.0.0.0' })
