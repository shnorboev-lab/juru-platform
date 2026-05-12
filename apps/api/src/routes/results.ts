import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, requireRole, getEmployee } from '../lib/auth.js'

export async function resultRoutes(app: FastifyInstance) {
  // My result for a cycle
  app.get('/my', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    const { cycleId } = req.query as { cycleId?: string }
    if (!cycleId) return []

    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } })
    if (!cycle.resultsReleasedAt) return null  // not released yet

    return prisma.result.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId: emp.id } },
      include: { subResults: true },
    })
  })

  // All results for a cycle — HR / Team Head / BU Head
  app.get('/', { preHandler: requireAuth }, async (req) => {
    const { cycleId, buId, teamId, isAtRisk, isNominated } = req.query as Record<string, string>
    return prisma.result.findMany({
      where: {
        ...(cycleId     ? { cycleId }                  : {}),
        ...(isAtRisk    ? { isAtRisk: isAtRisk === 'true' }    : {}),
        ...(isNominated ? { isNominated: isNominated === 'true' } : {}),
        ...(buId   ? { employee: { buId } }   : {}),
        ...(teamId ? { employee: { teamId } } : {}),
      },
      include: {
        employee:   { select: { fullName: true, email: true, grade: true, seniorityTier: true, team: { select: { name: true } } } },
        subResults: true,
      },
      orderBy: { overallAvg: 'desc' },
    })
  })

  // Single result
  app.get('/:cycleId/:employeeId', { preHandler: requireAuth }, async (req) => {
    const { cycleId, employeeId } = req.params as { cycleId: string; employeeId: string }
    return prisma.result.findUnique({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      include: {
        employee:   { include: { team: true, bu: true } },
        subResults: true,
      },
    })
  })

  // Save interview note — Team Head
  app.patch('/:cycleId/:employeeId/interview', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req) => {
    const { cycleId, employeeId } = req.params as { cycleId: string; employeeId: string }
    const { note, done } = req.body as { note?: string; done?: boolean }
    return prisma.result.update({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      data: {
        ...(note !== undefined ? { interviewNote: note } : {}),
        ...(done ? { interviewDoneAt: new Date() } : {}),
      },
    })
  })

  // Distribution analytics — HR / BU Head
  app.get('/analytics/distribution', { preHandler: requireAuth }, async (req) => {
    const { cycleId } = req.query as { cycleId?: string }
    if (!cycleId) return []
    const results = await prisma.result.findMany({
      where: { cycleId },
      select: { performanceLabel: true, isAtRisk: true, isNominated: true, overallAvg: true },
    })
    const dist: Record<string, number> = {}
    for (const r of results) {
      dist[r.performanceLabel] = (dist[r.performanceLabel] ?? 0) + 1
    }
    return {
      distribution: dist,
      atRiskCount:   results.filter(r => r.isAtRisk).length,
      nominatedCount: results.filter(r => r.isNominated).length,
      avgScore: results.reduce((s, r) => s + Number(r.overallAvg), 0) / (results.length || 1),
    }
  })
}
