import { FastifyInstance } from 'fastify'
import { prisma, Role, Grade, SeniorityTier } from '@juru/db'
import { z } from 'zod'

const ALLOWED_DOMAIN = process.env.ALLOWED_DOMAIN ?? 'juru.org'
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID!
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!
const GOOGLE_CALLBACK_URL  = process.env.GOOGLE_CALLBACK_URL!
const FRONTEND_URL         = process.env.FRONTEND_URL ?? 'http://localhost:3000'

function gradeToSeniority(grade: Grade): SeniorityTier {
  const entry = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4','I'] as string[]
  const mid   = ['SE1','SE2','SE3','SE4','SC1','SC2','SC3','SC4'] as string[]
  if (entry.includes(grade)) return SeniorityTier.ENTRY
  if (mid.includes(grade))   return SeniorityTier.MID
  return SeniorityTier.SENIOR
}

export async function authRoutes(app: FastifyInstance) {
  // Google OAuth — redirect to Google
  app.get('/google', async (req, reply) => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_CALLBACK_URL,
      response_type: 'code',
      scope: 'openid email profile',
      hd: ALLOWED_DOMAIN,  // restrict to juru.org hosted domain
    })
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  })

  // Google OAuth — callback
  app.get('/google/callback', async (req, reply) => {
    const { code } = req.query as { code?: string }
    if (!code) return reply.status(400).send({ error: 'Missing code' })

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }
    if (!tokenData.access_token) {
      return reply.status(401).send({ error: 'OAuth token exchange failed' })
    }

    // Get user info
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userRes.json() as { email?: string; name?: string; picture?: string }

    if (!googleUser.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
      return reply.redirect(`${FRONTEND_URL}/login?error=domain`)
    }

    // Upsert employee from Google profile
    let employee = await prisma.employee.findUnique({ where: { email: googleUser.email } })
    if (!employee) {
      // First-time login: create minimal record; HR assigns grade/team later
      employee = await prisma.employee.create({
        data: {
          fullName: googleUser.name ?? googleUser.email,
          email: googleUser.email,
          grade: Grade.E1,
          seniorityTier: SeniorityTier.ENTRY,
          role: Role.EMPLOYEE,
        },
      })
    }

    const token = app.jwt.sign(
      { sub: employee.id, email: employee.email, role: employee.role },
      { expiresIn: '8h' }
    )

    return reply.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${employee.role}`)
  })

  // Dev-only login — bypasses OAuth, issues a real JWT
  app.post('/dev-login', async (req, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not found' })
    }
    const { email } = req.body as { email?: string }
    if (!email) return reply.status(400).send({ error: 'email required' })

    const employee = await prisma.employee.findUnique({ where: { email } })
    if (!employee) return reply.status(404).send({ error: 'Employee not found' })

    const token = app.jwt.sign(
      { sub: employee.id, email: employee.email, role: employee.role },
      { expiresIn: '8h' }
    )
    return { token, role: employee.role, employee }
  })

  // Verify token — called by frontend
  app.get('/me', async (req, reply) => {
    try {
      await req.jwtVerify()
      const payload = req.user as { sub: string }
      const employee = await prisma.employee.findUnique({
        where: { id: payload.sub },
        include: { team: true, bu: true },
      })
      return employee
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
}
