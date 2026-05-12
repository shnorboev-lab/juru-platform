import { FastifyInstance } from 'fastify'
import { prisma, Grade, SeniorityTier, Role } from '@juru/db'
import { requireAuth, requireRole } from '../lib/auth.js'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

const CreateEmployeeSchema = z.object({
  juruId:   z.string().optional(),
  fullName: z.string().min(2),
  email:    z.string().email(),
  position: z.string().optional(),
  office:   z.string().optional(),
  grade:    z.nativeEnum(Grade),
  role:     z.nativeEnum(Role).optional(),
  teamId:   z.string().uuid().optional(),
  buId:     z.string().uuid().optional(),
  joinedAt: z.string().datetime().optional(),
})

const UpdateEmployeeSchema = CreateEmployeeSchema.partial()

function gradeToSeniority(grade: Grade): SeniorityTier {
  const entry = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4','I'] as string[]
  const mid   = ['SE1','SE2','SE3','SE4','SC1','SC2','SC3','SC4'] as string[]
  if (entry.includes(grade)) return SeniorityTier.ENTRY
  if (mid.includes(grade))   return SeniorityTier.MID
  return SeniorityTier.SENIOR
}

// Normalise grade strings from Excel (e.g. "PC1" is valid, "na" → skip)
function normaliseGrade(raw: string): Grade | null {
  const s = raw.trim().toUpperCase()
  const valid = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4','SE1','SE2','SE3','SE4',
    'SC1','SC2','SC3','SC4','PE','PE1','PE2','PE3','PC','PC1','PC2','M1','M2','M3','M4',
    'SM1','SM2','SM3','SM4','D1','D2','D3','MD','I']
  return valid.includes(s) ? s as Grade : null
}

// Map BU name from Excel to a normalised form
function normaliseBU(raw: string) {
  const m: Record<string, string> = {
    'Corporate': 'Corporate',
    'SBU':       'Sustainability Business Unit',
    'EC':        'Engineering & Consulting',
    'EDM':       'Engineering, Design & Management',
  }
  return m[raw] ?? raw
}

export async function employeeRoutes(app: FastifyInstance) {
  // List employees
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { buId, teamId, isActive, search } = req.query as Record<string, string>
    return prisma.employee.findMany({
      where: {
        ...(buId   ? { buId }   : {}),
        ...(teamId ? { teamId } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        ...(search ? {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { juruId:   { contains: search, mode: 'insensitive' } },
            { email:    { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: { team: { select: { name: true } }, bu: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
    })
  })

  // Get single employee
  app.get('/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.employee.findUniqueOrThrow({
      where: { id },
      include: { team: true, bu: true },
    })
  })

  // Create (onboard) employee — HR only
  app.post('/', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const body = CreateEmployeeSchema.parse(req.body)
    const employee = await prisma.employee.create({
      data: {
        ...body,
        seniorityTier: gradeToSeniority(body.grade),
        role: body.role ?? Role.EMPLOYEE,
        joinedAt: body.joinedAt ? new Date(body.joinedAt) : undefined,
      },
    })
    return reply.status(201).send(employee)
  })

  // Update employee — HR only (also handles inline email/role edits)
  app.patch('/:id', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { id } = req.params as { id: string }
    const body   = UpdateEmployeeSchema.parse(req.body)
    return prisma.employee.update({
      where: { id },
      data: {
        ...body,
        ...(body.grade ? { seniorityTier: gradeToSeniority(body.grade) } : {}),
        ...(body.joinedAt ? { joinedAt: new Date(body.joinedAt) } : {}),
      },
      include: { team: { select: { name: true } }, bu: { select: { name: true } } },
    })
  })

  // Count employees missing real emails (placeholder juruId-based emails)
  app.get('/meta/email-stats', { preHandler: requireRole('HR_ADMIN') }, async () => {
    const all     = await prisma.employee.count({ where: { isActive: true } })
    // Emails we auto-generated look like "lo15001@juru.org" — juruId in lowercase before @
    const noEmail = await prisma.employee.count({
      where: {
        isActive: true,
        OR: [
          { email: { contains: '15' } },
          { email: { contains: '16' } },
          { email: { contains: '17' } },
          { email: { contains: '18' } },
          { email: { contains: '19' } },
          { email: { contains: '20' } },
          { email: { contains: '21' } },
          { email: { contains: '22' } },
          { email: { contains: '23' } },
          { email: { contains: '24' } },
        ],
      },
    })
    return { total: all, withPlaceholderEmail: noEmail, withRealEmail: all - noEmail }
  })

  // Deactivate (offboard)
  app.delete('/:id', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.employee.update({ where: { id }, data: { isActive: false } })
  })

  // Import from Excel/CSV — HR only
  // Accepts the Juru Employee Data xlsx exported as CSV, OR the raw xlsx via multipart
  // Columns expected: #, Employee name, Position, Business Unit, Team, Office, Juru ID
  app.post('/import', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const buf = await data.toBuffer()
    let rows: string[][]

    if (data.filename.endsWith('.xlsx') || data.mimetype.includes('spreadsheet')) {
      // Dynamically import xlsx (CJS)
      const { createRequire } = await import('module')
      const require = createRequire(import.meta.url)
      const XLSX = require('xlsx') as typeof import('xlsx')
      const wb = XLSX.read(buf, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as string[][]
    } else {
      rows = parse(buf, { relax_quotes: true, skip_empty_lines: true }) as string[][]
    }

    // Find header row (has "Juru ID" in it)
    const headerIdx = rows.findIndex(r => r.some(c => String(c ?? '').includes('Juru ID')))
    if (headerIdx === -1) return reply.status(400).send({ error: 'Could not find header row with "Juru ID" column' })

    const dataRows = rows.slice(headerIdx + 1).filter(r => r[0] && r[6]) // # and Juru ID

    let created = 0, updated = 0, skipped = 0

    for (const row of dataRows) {
      const juruId   = String(row[6] ?? '').trim()
      const fullName = String(row[1] ?? '').trim()
      const position = String(row[2] ?? '').trim() || null
      const buName   = String(row[3] ?? '').trim()
      const teamName = String(row[4] ?? '').trim()
      const office   = String(row[5] ?? '').trim() || null
      const status   = String(row[12] ?? '').trim()

      if (!juruId || !fullName || !buName) { skipped++; continue }

      const isActive = status !== 'Inactive'

      // Upsert BU
      const normBU = normaliseBU(buName)
      const bu = await prisma.businessUnit.upsert({
        where: { name: normBU },
        update: {},
        create: { name: normBU },
      })

      // Upsert Team
      let teamRecord = null
      if (teamName && teamName !== 'undefined') {
        teamRecord = await prisma.team.upsert({
          where: { buId_name: { buId: bu.id, name: teamName } },
          update: {},
          create: { name: teamName, buId: bu.id },
        })
      }

      // Build email from juruId if not in file
      const email = `${juruId.toLowerCase()}@juru.org`

      // Upsert employee by juruId
      const existing = await prisma.employee.findUnique({ where: { juruId } })
      if (existing) {
        await prisma.employee.update({
          where: { juruId },
          data: {
            fullName,
            position,
            office,
            buId:   bu.id,
            teamId: teamRecord?.id ?? null,
            isActive,
          },
        })
        updated++
      } else {
        await prisma.employee.create({
          data: {
            juruId,
            fullName,
            email,
            position,
            office,
            grade: Grade.E1,
            seniorityTier: SeniorityTier.ENTRY,
            role: Role.EMPLOYEE,
            buId: bu.id,
            teamId: teamRecord?.id ?? null,
            isActive,
          },
        })
        created++
      }
    }

    return { created, updated, skipped, total: dataRows.length }
  })

  // Import grades from Staff Grades Excel (col[0]=seq, col[1]=name, col[2]=grade, sheets=BU names)
  app.post('/import-grades', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })
    const buf = await data.toBuffer()
    const { createRequire } = await import('module')
    const require = createRequire(import.meta.url)
    const XLSX = require('xlsx') as typeof import('xlsx')
    const wb = XLSX.read(buf, { type: 'buffer' })

    let updated = 0, skipped = 0, unmatched: string[] = []

    for (const sheetName of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as string[][]
      const dataRows = rows.filter(r => r[0] && r[1] && r[2])
      for (const row of dataRows) {
        const name  = String(row[1] ?? '').trim()
        const grade = normaliseGrade(String(row[2] ?? ''))
        if (!name || !grade) { skipped++; continue }

        // Match by full name (case-insensitive)
        const emp = await prisma.employee.findFirst({
          where: { fullName: { equals: name, mode: 'insensitive' }, isActive: true },
        })
        if (!emp) { unmatched.push(name); skipped++; continue }

        await prisma.employee.update({
          where: { id: emp.id },
          data: { grade, seniorityTier: gradeToSeniority(grade) },
        })
        updated++
      }
    }

    return { updated, skipped, unmatched: unmatched.slice(0, 20), total: updated + skipped }
  })

  // Staff progress for BU Head — employees in their BU with submission status for a cycle
  app.get('/bu-progress/:cycleId', { preHandler: requireAuth }, async (req) => {
    const { cycleId } = req.params as { cycleId: string }
    const emp = await prisma.employee.findFirstOrThrow({
      where: { id: (req.user as { sub: string }).sub },
    })

    const where = ['BU_HEAD','HR_ADMIN','MD','TEAM_HEAD'].includes(emp.role)
      ? (emp.role === 'HR_ADMIN' || emp.role === 'MD' ? {} : { buId: emp.buId ?? undefined })
      : { buId: emp.buId ?? undefined }

    const employees = await prisma.employee.findMany({
      where: { ...where, isActive: true, role: { in: ['EMPLOYEE','EVALUATOR','TEAM_HEAD','BU_HEAD'] } },
      include: { team: { select: { name: true } }, bu: { select: { name: true } } },
      orderBy: [{ bu: { name: 'asc' } }, { team: { name: 'asc' } }, { fullName: 'asc' }],
    })

    const submissions = await prisma.submission.findMany({
      where: { cycleId },
      select: { employeeId: true, submittedBy: true, type: true, status: true },
    })

    const subMap = new Map<string, { self?: string; eval1?: string; eval2?: string }>()
    for (const s of submissions) {
      const key = s.employeeId
      if (!subMap.has(key)) subMap.set(key, {})
      const entry = subMap.get(key)!
      if (s.type === 'SELF')   entry.self  = s.status
      if (s.type === 'EVAL_1') entry.eval1 = s.status
      if (s.type === 'EVAL_2') entry.eval2 = s.status
    }

    return employees.map(e => ({
      ...e,
      submissions: subMap.get(e.id) ?? {},
    }))
  })

  // List BUs & Teams
  app.get('/meta/business-units', { preHandler: requireAuth }, async () =>
    prisma.businessUnit.findMany({ include: { teams: true }, orderBy: { name: 'asc' } })
  )
}
