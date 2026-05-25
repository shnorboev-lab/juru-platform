import { FastifyInstance } from 'fastify'
import { prisma, SubCriterion, SubmissionType } from '@juru/db'
import { requireAuth, requireRole, getEmployee } from '../lib/auth.js'
import { scoringQueue } from '../jobs/queues.js'
import { notifyMany } from '../services/notify.js'
import { z } from 'zod'

const ScoreInput = z.object({
  subCriterion: z.nativeEnum(SubCriterion),
  score:        z.number().int().min(1).max(5),
  note:         z.string().optional(),
})

const SubmitSchema = z.object({
  cycleId:    z.string().uuid(),
  employeeId: z.string().uuid(),
  type:       z.nativeEnum(SubmissionType),
  comment:    z.string().optional(),
  scores:     z.array(ScoreInput).length(10),
})

export async function submissionRoutes(app: FastifyInstance) {
  // Get my submissions (SELF type only, all cycles or filtered)
  app.get('/my', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { cycleId } = req.query as { cycleId?: string }
    return prisma.submission.findMany({
      where: {
        employeeId: emp.id,
        type: 'SELF',
        ...(cycleId ? { cycleId } : {}),
      },
      include: {
        scores: true,
        cycle: { select: { id: true, label: true, type: true, year: true, phase: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // Get evaluations submitted BY me (as evaluator) across all cycles
  app.get('/as-evaluator', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { cycleId } = req.query as { cycleId?: string }
    return prisma.submission.findMany({
      where: {
        submittedBy: emp.id,
        type: { in: ['EVAL_1', 'EVAL_2'] },
        ...(cycleId ? { cycleId } : {}),
      },
      include: {
        scores: true,
        employee: { select: { id: true, fullName: true, grade: true, juruId: true, team: { select: { name: true } } } },
        cycle:    { select: { id: true, label: true, type: true, year: true, phase: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  })

  // Get assignments where I am an evaluator (to find pending ones)
  app.get('/my-eval-assignments', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { cycleId } = req.query as { cycleId?: string }
    const assignments = await prisma.assignment.findMany({
      where: {
        OR: [{ evaluator1Id: emp.id }, { evaluator2Id: emp.id }],
        ...(cycleId ? { cycleId } : {}),
        cycle: { phase: { in: ['EVALUATION', 'CONSOLIDATION'] } },
      },
      include: {
        employee: { select: { id: true, fullName: true, grade: true, juruId: true, team: { select: { name: true } } } },
        cycle:    { select: { id: true, label: true, phase: true, evaluationEnd: true } },
      },
    })
    // Attach my eval type and existing submission status
    return Promise.all(assignments.map(async a => {
      const evalType = a.evaluator1Id === emp.id ? 'EVAL_1' : 'EVAL_2'
      const sub = await prisma.submission.findUnique({
        where: { cycleId_employeeId_type: { cycleId: a.cycleId, employeeId: a.employeeId, type: evalType } },
        select: { status: true },
      })
      return { ...a, evalType, submissionStatus: sub?.status ?? null }
    }))
  })

  // Get all submissions for a cycle — HR / Team Head
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { cycleId, employeeId } = req.query as Record<string, string>
    return prisma.submission.findMany({
      where: {
        ...(cycleId    ? { cycleId }    : {}),
        ...(employeeId ? { employeeId } : {}),
      },
      include: { scores: true, employee: { select: { fullName: true, email: true } } },
    })
  })

  // Save draft or submit
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const body   = SubmitSchema.parse(req.body)
    const actor  = await getEmployee(req)
    const { isDraft } = req.query as { isDraft?: string }

    // Check cycle phase allows this submission
    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: body.cycleId } })
    if (body.type === 'SELF' && !['SELF_APPRAISAL'].includes(cycle.phase)) {
      return reply.status(409).send({ error: 'Self-appraisal phase is not open' })
    }
    if (['EVAL_1','EVAL_2'].includes(body.type) && !['EVALUATION','CONSOLIDATION'].includes(cycle.phase)) {
      return reply.status(409).send({ error: 'Evaluation phase is not open' })
    }

    const status     = isDraft === 'true' ? 'DRAFT' : 'SUBMITTED'
    const submittedAt = status === 'SUBMITTED' ? new Date() : undefined

    const submission = await prisma.submission.upsert({
      where: {
        cycleId_employeeId_type: {
          cycleId:    body.cycleId,
          employeeId: body.employeeId,
          type:       body.type,
        },
      },
      update: {
        status,
        comment: body.comment,
        submittedAt,
        submittedBy: actor.id,
        scores: {
          deleteMany: {},
          create: body.scores,
        },
      },
      create: {
        cycleId:     body.cycleId,
        employeeId:  body.employeeId,
        submittedBy: actor.id,
        type:        body.type,
        status,
        comment:     body.comment,
        submittedAt,
        scores: { create: body.scores },
      },
      include: { scores: true },
    })

    // If both evaluators submitted, enqueue scoring
    if (status === 'SUBMITTED' && ['EVAL_1','EVAL_2'].includes(body.type)) {
      const [e1, e2] = await Promise.all([
        prisma.submission.findUnique({
          where: { cycleId_employeeId_type: { cycleId: body.cycleId, employeeId: body.employeeId, type: 'EVAL_1' } },
        }),
        prisma.submission.findUnique({
          where: { cycleId_employeeId_type: { cycleId: body.cycleId, employeeId: body.employeeId, type: 'EVAL_2' } },
        }),
      ])
      if (e1?.status === 'SUBMITTED' && e2?.status === 'SUBMITTED') {
        await scoringQueue.add('calculate', { cycleId: body.cycleId, employeeId: body.employeeId })
      }
    }

    return reply.status(201).send(submission)
  })

  // Team Head: view their team's self-appraisals (read-only)
  app.get('/team-appraisals', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    const emp = await getEmployee(req)
    const teamId = emp.role === 'TEAM_HEAD' ? emp.teamId ?? undefined : undefined

    const employees = await prisma.employee.findMany({
      where: { isActive: true, ...(teamId ? { teamId } : {}) },
      select: {
        id: true, fullName: true, email: true, grade: true, juruId: true,
        team: { select: { name: true } },
        bu:   { select: { name: true } },
      },
      orderBy: [{ bu: { name: 'asc' } }, { fullName: 'asc' }],
    })

    const selfSubs = cycleId ? await prisma.submission.findMany({
      where: { cycleId, type: 'SELF' },
      include: { scores: true },
    }) : []

    return employees.map(e => ({
      employee:      e,
      selfAppraisal: selfSubs.find(s => s.employeeId === e.id) ?? null,
    }))
  })

  // HR: list all self-appraisals for a cycle with employee/evaluator context
  app.get('/self-appraisals', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    const assignments = await prisma.assignment.findMany({
      where: cycleId ? { cycleId } : {},
      include: {
        employee:   { select: { id: true, fullName: true, email: true, grade: true, juruId: true, team: { select: { name: true } }, bu: { select: { name: true } } } },
        evaluator1: { select: { id: true, fullName: true, email: true } },
        evaluator2: { select: { id: true, fullName: true, email: true } },
        cycle:      { select: { id: true, label: true, phase: true } },
      },
      orderBy: [{ employee: { bu: { name: 'asc' } } }, { employee: { fullName: 'asc' } }],
    })

    const selfSubs = cycleId ? await prisma.submission.findMany({
      where: { cycleId, type: 'SELF' },
      include: { scores: true },
    }) : []

    return assignments.map(a => ({
      assignmentId: a.id,
      cycleId: a.cycleId,
      cycle: a.cycle,
      employee: a.employee,
      evaluator1: a.evaluator1,
      evaluator2: a.evaluator2,
      selfAppraisal: selfSubs.find(s => s.employeeId === a.employeeId) ?? null,
    }))
  })

  // HR: share self-appraisal with team head and BU head
  app.post('/share-self-appraisal', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId, employeeId } = req.body as { cycleId: string; employeeId: string }

    const assignment = await prisma.assignment.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      include: {
        employee: { select: { fullName: true, bu: { select: { id: true } }, team: { select: { id: true } } } },
        cycle:    { select: { label: true } },
      },
    })
    if (!assignment) return reply.status(404).send({ error: 'Assignment not found' })

    const selfSub = await prisma.submission.findUnique({
      where: { cycleId_employeeId_type: { cycleId, employeeId, type: 'SELF' } },
    })
    if (!selfSub || selfSub.status !== 'SUBMITTED') {
      return reply.status(409).send({ error: 'Self-appraisal not yet submitted' })
    }

    // Find team head and BU head for this employee
    const recipients: string[] = []
    if (assignment.employee.bu?.id) {
      const buHead = await prisma.employee.findFirst({ where: { buId: assignment.employee.bu.id, role: 'BU_HEAD' } })
      if (buHead) recipients.push(buHead.id)
    }
    if (assignment.employee.team?.id) {
      const teamHead = await prisma.employee.findFirst({ where: { teamId: assignment.employee.team.id, role: 'TEAM_HEAD' } })
      if (teamHead) recipients.push(teamHead.id)
    }

    if (recipients.length === 0) return reply.status(404).send({ error: 'No Team Head or BU Head found for this employee' })

    await notifyMany(recipients, {
      event:    'CYCLE_OPENED',
      channels: ['EMAIL', 'IN_APP'],
      subject:  `Self-appraisal shared — ${assignment.employee.fullName} (${assignment.cycle.label})`,
      body:     `HR has shared the self-appraisal of <b>${assignment.employee.fullName}</b> with you for <b>${assignment.cycle.label}</b>. Please log in to review.`,
    })

    return { shared: recipients.length }
  })

  // HR: bulk notify all employees to submit self-appraisal
  app.post('/notify-all', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId, employeeIds } = req.body as { cycleId: string; employeeIds: string[] }
    if (!cycleId || !employeeIds?.length) return reply.status(400).send({ error: 'cycleId and employeeIds required' })
    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } })
    await notifyMany(employeeIds, {
      event: 'CYCLE_OPENED', channels: ['EMAIL', 'IN_APP'],
      subject: `Self-appraisal is open — ${cycle.label}`,
      body: `The self-appraisal period for <b>${cycle.label}</b> is now open. Please log in to complete your self-appraisal before the deadline.`,
    })
    return { notified: employeeIds.length }
  })

  // HR: share all submitted self-appraisals with team/BU heads
  app.post('/share-all', { preHandler: requireRole('HR_ADMIN') }, async (req, reply) => {
    const { cycleId } = req.body as { cycleId: string }
    const submitted = await prisma.submission.findMany({
      where: { cycleId, type: 'SELF', status: 'SUBMITTED' },
      include: {
        employee: {
          select: { fullName: true, bu: { select: { id: true } }, team: { select: { id: true } } },
        },
      },
    })
    const recipientSet = new Set<string>()
    for (const sub of submitted) {
      if (sub.employee.bu?.id) {
        const buHead = await prisma.employee.findFirst({ where: { buId: sub.employee.bu.id, role: 'BU_HEAD' } })
        if (buHead) recipientSet.add(buHead.id)
      }
      if (sub.employee.team?.id) {
        const teamHead = await prisma.employee.findFirst({ where: { teamId: sub.employee.team.id, role: 'TEAM_HEAD' } })
        if (teamHead) recipientSet.add(teamHead.id)
      }
    }
    const ids = [...recipientSet]
    if (ids.length === 0) return reply.status(404).send({ error: 'No Team Heads or BU Heads found' })
    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } })
    await notifyMany(ids, {
      event: 'CYCLE_OPENED', channels: ['EMAIL', 'IN_APP'],
      subject: `Self-appraisals ready for review — ${cycle.label}`,
      body: `HR has shared <b>${submitted.length}</b> submitted self-appraisals for <b>${cycle.label}</b>. Please log in to review your team's submissions.`,
    })
    return { shared: submitted.length, notified: ids.length }
  })
}
