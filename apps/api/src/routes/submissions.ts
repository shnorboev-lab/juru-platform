import { FastifyInstance } from 'fastify'
import { prisma, SubCriterion, SubmissionType } from '@juru/db'
import { requireAuth, getEmployee } from '../lib/auth.js'
import { scoringQueue } from '../jobs/queues.js'
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
  // Get my submissions for a cycle
  app.get('/my', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { cycleId } = req.query as { cycleId?: string }
    return prisma.submission.findMany({
      where: {
        submittedBy: emp.id,
        ...(cycleId ? { cycleId } : {}),
      },
      include: { scores: true },
    })
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
}
