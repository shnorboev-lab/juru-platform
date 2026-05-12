import { FastifyInstance } from 'fastify'
import { prisma, CyclePhase, CycleType } from '@juru/db'
import { requireAuth, requireRole, getEmployee } from '../lib/auth.js'
import { z } from 'zod'

// Accept both full ISO datetime strings and plain date strings (YYYY-MM-DD)
const dateField = z.string().refine(s => !isNaN(Date.parse(s)), 'Invalid date')

const CreateCycleSchema = z.object({
  type: z.nativeEnum(CycleType),
  year: z.number().int().min(2020).max(2050),
  label: z.string().min(3),
  buId: z.string().uuid(),
  selfAppraisalStart: dateField,
  selfAppraisalEnd:   dateField,
  evaluationEnd:      dateField,
  consolidationEnd:   dateField,
  interviewEnd:       dateField,
})

export async function cycleRoutes(app: FastifyInstance) {
  // List all cycles (filtered by BU for non-HR)
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    return prisma.reviewCycle.findMany({
      where: emp.role === 'HR_ADMIN' ? {} : { buId: emp.buId ?? undefined },
      include: { bu: { select: { name: true } } },
      orderBy: [{ year: 'desc' }, { type: 'asc' }],
    })
  })

  // Get single cycle
  app.get('/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.reviewCycle.findUniqueOrThrow({
      where: { id },
      include: {
        bu: true,
        assignments: { include: { employee: true, evaluator1: true, evaluator2: true } },
        _count: { select: { submissions: true, results: true } },
      },
    })
  })

  // Create cycle — HR only
  app.post('/', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const body = CreateCycleSchema.parse(req.body)
    const cycle = await prisma.reviewCycle.create({
      data: {
        type:               body.type,
        year:               body.year,
        label:              body.label,
        buId:               body.buId,
        selfAppraisalStart: new Date(body.selfAppraisalStart as string),
        selfAppraisalEnd:   new Date(body.selfAppraisalEnd as string),
        evaluationEnd:      new Date(body.evaluationEnd as string),
        consolidationEnd:   new Date(body.consolidationEnd as string),
        interviewEnd:       new Date(body.interviewEnd as string),
        phase:              CyclePhase.PREP,
      },
    })
    return reply.status(201).send(cycle)
  })

  // Advance phase manually — HR only
  app.patch('/:id/phase', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { id }   = req.params as { id: string }
    const { phase } = req.body as { phase: CyclePhase }
    return prisma.reviewCycle.update({ where: { id }, data: { phase } })
  })

  // Release results — HR only
  app.post('/:id/release', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { id } = req.params as { id: string }
    return prisma.reviewCycle.update({
      where: { id },
      data: { resultsReleasedAt: new Date() },
    })
  })

  // Cycle activity — submissions + phase events for the admin live feed
  app.get('/:id/activity', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }

    const [submissions, assignments, cycle] = await Promise.all([
      prisma.submission.findMany({
        where: { cycleId: id },
        include: {
          employee: { select: { fullName: true, juruId: true, grade: true, team: { select: { name: true } } } },
          scores: { select: { subCriterion: true, score: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.assignment.findMany({
        where: { cycleId: id },
        include: {
          employee:   { select: { id: true, fullName: true, juruId: true, email: true, grade: true, team: { select: { name: true } } } },
          evaluator1: { select: { id: true, fullName: true, juruId: true, email: true } },
          evaluator2: { select: { id: true, fullName: true, juruId: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.reviewCycle.findUniqueOrThrow({ where: { id } }),
    ])

    // Count by type
    const submitted = (type: string) => submissions.filter(s => s.type === type && s.status === 'SUBMITTED').length
    const drafted   = (type: string) => submissions.filter(s => s.type === type && s.status === 'DRAFT').length

    // Per-employee status matrix
    const empStatus = assignments.map(a => {
      const self  = submissions.find(s => s.employeeId === a.employeeId && s.type === 'SELF')
      const eval1 = submissions.find(s => s.employeeId === a.employeeId && s.type === 'EVAL_1')
      const eval2 = submissions.find(s => s.employeeId === a.employeeId && s.type === 'EVAL_2')
      return {
        employee:   a.employee,
        evaluator1: a.evaluator1,
        evaluator2: a.evaluator2,
        self:       self  ? { status: self.status,  updatedAt: self.updatedAt }  : null,
        eval1:      eval1 ? { status: eval1.status, updatedAt: eval1.updatedAt } : null,
        eval2:      eval2 ? { status: eval2.status, updatedAt: eval2.updatedAt } : null,
      }
    })

    return {
      cycle,
      totals: {
        assigned:    assignments.length,
        selfDone:    submitted('SELF'),
        selfDraft:   drafted('SELF'),
        eval1Done:   submitted('EVAL_1'),
        eval2Done:   submitted('EVAL_2'),
      },
      employees: empStatus,
    }
  })

  // Cycle progress stats
  app.get('/:id/stats', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }
    const [assignments, selfSubs, eval1Subs, eval2Subs, results] = await Promise.all([
      prisma.assignment.count({ where: { cycleId: id } }),
      prisma.submission.count({ where: { cycleId: id, type: 'SELF',   status: 'SUBMITTED' } }),
      prisma.submission.count({ where: { cycleId: id, type: 'EVAL_1', status: 'SUBMITTED' } }),
      prisma.submission.count({ where: { cycleId: id, type: 'EVAL_2', status: 'SUBMITTED' } }),
      prisma.result.count({ where: { cycleId: id } }),
    ])
    return { assignments, selfSubs, eval1Subs, eval2Subs, results }
  })
}
