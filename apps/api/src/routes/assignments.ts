import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, requireRole } from '../lib/auth.js'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

const MatrixRowSchema = z.object({
  'Employee Name':   z.string(),
  'Email':           z.string().email(),
  'Evaluator 1 (70%) Email': z.string().email(),
  'Evaluator 2 (30%) Email': z.string().email(),
})

export async function assignmentRoutes(app: FastifyInstance) {
  // List assignments for a cycle
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    if (!cycleId) return []
    return prisma.assignment.findMany({
      where: { cycleId },
      include: {
        employee:   { select: { id: true, fullName: true, email: true, grade: true } },
        evaluator1: { select: { id: true, fullName: true, email: true } },
        evaluator2: { select: { id: true, fullName: true, email: true } },
      },
    })
  })

  // Upload matrix CSV — HR only
  app.post('/upload', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId } = req.query as { cycleId: string }
    if (!cycleId) return reply.status(400).send({ error: 'cycleId required' })

    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded' })

    const csvText = (await data.toBuffer()).toString('utf-8')
    const rows = parse(csvText, { columns: true, skip_empty_lines: true })

    const results: { email: string; status: string; error?: string }[] = []

    for (const row of rows) {
      try {
        const parsed = MatrixRowSchema.parse(row)

        const [employee, eval1, eval2] = await Promise.all([
          prisma.employee.findUnique({ where: { email: parsed['Email'] } }),
          prisma.employee.findUnique({ where: { email: parsed['Evaluator 1 (70%) Email'] } }),
          prisma.employee.findUnique({ where: { email: parsed['Evaluator 2 (30%) Email'] } }),
        ])

        if (!employee) throw new Error(`Employee not found: ${parsed['Email']}`)
        if (!eval1)    throw new Error(`Evaluator 1 not found: ${parsed['Evaluator 1 (70%) Email']}`)
        if (!eval2)    throw new Error(`Evaluator 2 not found: ${parsed['Evaluator 2 (30%) Email']}`)

        await prisma.assignment.upsert({
          where: { cycleId_employeeId: { cycleId, employeeId: employee.id } },
          update: { evaluator1Id: eval1.id, evaluator2Id: eval2.id },
          create: {
            cycleId,
            employeeId:   employee.id,
            evaluator1Id: eval1.id,
            evaluator2Id: eval2.id,
          },
        })
        results.push({ email: parsed['Email'], status: 'ok' })
      } catch (err: unknown) {
        results.push({ email: (row as Record<string,string>)['Email'] ?? '?', status: 'error', error: String(err) })
      }
    }

    return { processed: results.length, results }
  })
}
