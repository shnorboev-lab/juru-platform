import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireRole } from '../lib/auth.js'
import { reportQueue } from '../jobs/queues.js'

export async function reportRoutes(app: FastifyInstance) {
  // List reports for a cycle
  app.get('/', { preHandler: requireRole('HR_ADMIN', 'BU_HEAD', 'TEAM_HEAD') }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    return prisma.report.findMany({
      where: cycleId ? { cycleId } : {},
      orderBy: { createdAt: 'desc' },
    })
  })

  // Trigger report generation
  app.post('/generate', { preHandler: requireRole('HR_ADMIN', 'BU_HEAD') }, async (req, reply) => {
    const { cycleId } = req.body as { cycleId: string }
    if (!cycleId) return reply.status(400).send({ error: 'cycleId required' })

    const cycle = await prisma.reviewCycle.findUniqueOrThrow({
      where: { id: cycleId },
      include: { bu: true },
    })

    const report = await prisma.report.create({
      data: { cycleId, label: cycle.label },
    })

    await reportQueue.add('generate', { reportId: report.id, cycleId })

    return reply.status(202).send({ reportId: report.id, message: 'Report generation queued' })
  })
}
