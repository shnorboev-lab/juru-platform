import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, requireRole } from '../lib/auth.js'
import { parse } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { z } from 'zod'
import { notifyMany } from '../services/notify.js'

const MatrixRowSchema = z.object({
  employee_email:  z.string().email(),
  evaluator1_email: z.string().email(),
  evaluator2_email: z.string().email(),
})

function normaliseRow(raw: Record<string, string>) {
  const lower: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw)) lower[k.toLowerCase().trim()] = (v ?? '').toString().trim()

  // flexible column name resolution
  const empEmail  = lower['email'] ?? lower['employee email'] ?? lower['employee_email'] ?? ''
  const e1Email   = lower['evaluator 1 (70%) email'] ?? lower['evaluator1 email'] ?? lower['evaluator1_email'] ?? lower['evaluator 1 email'] ?? lower['e1 email'] ?? ''
  const e2Email   = lower['evaluator 2 (30%) email'] ?? lower['evaluator2 email'] ?? lower['evaluator2_email'] ?? lower['evaluator 2 email'] ?? lower['e2 email'] ?? ''

  return { employee_email: empEmail, evaluator1_email: e1Email, evaluator2_email: e2Email }
}

function parseExcel(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' })
}

export async function assignmentRoutes(app: FastifyInstance) {
  // List assignments for a cycle
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    if (!cycleId) return []
    return prisma.assignment.findMany({
      where: { cycleId },
      include: {
        employee:   { select: { id: true, fullName: true, email: true, grade: true, juruId: true, team: { select: { name: true } }, bu: { select: { id: true, name: true } } } },
        evaluator1: { select: { id: true, fullName: true, email: true } },
        evaluator2: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: [{ employee: { bu: { name: 'asc' } } }, { employee: { fullName: 'asc' } }],
    })
  })

  // Create a single assignment — HR only
  app.post('/', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId, employeeId, evaluator1Id, evaluator2Id } = req.body as {
      cycleId: string; employeeId: string; evaluator1Id: string; evaluator2Id: string
    }
    if (!cycleId || !employeeId || !evaluator1Id || !evaluator2Id)
      return reply.status(400).send({ error: 'cycleId, employeeId, evaluator1Id, evaluator2Id required' })
    const a = await prisma.assignment.upsert({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      update: { evaluator1Id, evaluator2Id },
      create: { cycleId, employeeId, evaluator1Id, evaluator2Id },
      include: {
        employee:   { select: { id: true, fullName: true, email: true, grade: true, juruId: true, team: { select: { name: true } }, bu: { select: { id: true, name: true } } } },
        evaluator1: { select: { id: true, fullName: true, email: true } },
        evaluator2: { select: { id: true, fullName: true, email: true } },
      },
    })
    return reply.status(201).send(a)
  })

  // Update a single assignment's evaluators — HR only
  app.patch('/:id', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { evaluator1Id, evaluator2Id } = req.body as { evaluator1Id?: string; evaluator2Id?: string }
    if (!evaluator1Id && !evaluator2Id) return reply.status(400).send({ error: 'Nothing to update' })
    const updated = await prisma.assignment.update({
      where: { id },
      data: {
        ...(evaluator1Id ? { evaluator1Id } : {}),
        ...(evaluator2Id ? { evaluator2Id } : {}),
      },
      include: {
        employee:   { select: { id: true, fullName: true, email: true, grade: true } },
        evaluator1: { select: { id: true, fullName: true, email: true } },
        evaluator2: { select: { id: true, fullName: true, email: true } },
      },
    })
    return updated
  })

  // Upload matrix (CSV or XLSX) — HR only
  app.post('/upload', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId } = req.query as { cycleId: string }
    if (!cycleId) return reply.status(400).send({ error: 'cycleId required' })

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const buffer = await data.toBuffer()
    const filename = (data.filename ?? '').toLowerCase()
    let rows: Record<string, string>[]

    if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      rows = parseExcel(buffer)
    } else {
      rows = parse(buffer.toString('utf-8'), { columns: true, skip_empty_lines: true })
    }

    const results: { name: string; status: string; error?: string }[] = []

    for (const rawRow of rows) {
      const row = normaliseRow(rawRow)
      const label = row.employee_email || JSON.stringify(rawRow)
      try {
        const parsed = MatrixRowSchema.parse(row)

        const [employee, eval1, eval2] = await Promise.all([
          prisma.employee.findFirst({ where: { email: { equals: parsed.employee_email, mode: 'insensitive' } } }),
          prisma.employee.findFirst({ where: { email: { equals: parsed.evaluator1_email, mode: 'insensitive' } } }),
          prisma.employee.findFirst({ where: { email: { equals: parsed.evaluator2_email, mode: 'insensitive' } } }),
        ])

        if (!employee) throw new Error(`Employee not found: ${parsed.employee_email}`)
        if (!eval1)    throw new Error(`Evaluator 1 not found: ${parsed.evaluator1_email}`)
        if (!eval2)    throw new Error(`Evaluator 2 not found: ${parsed.evaluator2_email}`)

        await prisma.assignment.upsert({
          where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
          update: { evaluator1Id: eval1.id, evaluator2Id: eval2.id },
          create: { cycleId, employeeId: employee.id, evaluator1Id: eval1.id, evaluator2Id: eval2.id },
        })
        results.push({ name: employee.fullName, status: 'ok' })
      } catch (err: unknown) {
        results.push({ name: label, status: 'error', error: String(err) })
      }
    }

    const ok    = results.filter(r => r.status === 'ok').length
    const errors = results.filter(r => r.status === 'error')
    return { processed: results.length, ok, errors }
  })

  // Approve matrix and notify evaluators — HR only
  // evaluatorIds: optional explicit list; if omitted, notifies all evaluators in the cycle
  app.post('/approve', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId, evaluatorIds } = req.body as { cycleId: string; evaluatorIds?: string[] }
    if (!cycleId) return reply.status(400).send({ error: 'cycleId required' })

    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } })

    let evalIds: string[]
    if (evaluatorIds?.length) {
      evalIds = evaluatorIds
    } else {
      const assignments = await prisma.assignment.findMany({ where: { cycleId } })
      evalIds = [...new Set([
        ...assignments.map(a => a.evaluator1Id).filter(Boolean),
        ...assignments.map(a => a.evaluator2Id).filter(Boolean),
      ])] as string[]
    }

    await notifyMany(evalIds, {
      event:    'EVAL_ASSIGNED',
      channels: ['EMAIL', 'IN_APP'],
      subject:  `You have been assigned as an evaluator — ${cycle.label}`,
      body:     `You have been assigned to evaluate staff in <b>${cycle.label}</b>. Please log in to review your assignments and complete evaluations before the deadline.`,
    })

    return { notified: evalIds.length }
  })
}
