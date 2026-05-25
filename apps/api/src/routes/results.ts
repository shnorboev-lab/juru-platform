import { FastifyInstance } from 'fastify'
import { prisma } from '@juru/db'
import { requireAuth, requireRole, getEmployee } from '../lib/auth.js'
import { calculateResult } from '../services/scoring.js'
import { notifyMany } from '../services/notify.js'

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

  // Employee: history of all their own results (released only)
  app.get('/my-history', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    return prisma.result.findMany({
      where: {
        employeeId: emp.id,
        cycle: { resultsReleasedAt: { not: null } },
      },
      include: {
        cycle:      { select: { id: true, label: true, type: true, year: true, phase: true } },
        subResults: true,
      },
      orderBy: { cycle: { year: 'desc' } },
    })
  })

  // Employee: interview feedback visible to them (note shared after done)
  app.get('/my-feedback', { preHandler: requireAuth }, async (req) => {
    const emp = await getEmployee(req)
    return prisma.result.findMany({
      where: { employeeId: emp.id, interviewDoneAt: { not: null } },
      select: {
        cycleId: true, interviewNote: true, interviewDoneAt: true, interviewScheduledAt: true,
        cycle: { select: { id: true, label: true } },
        performanceLabel: true, overallAvg: true,
      },
      orderBy: { interviewDoneAt: 'desc' },
    })
  })

  // Save interview note + optional schedule — Team Head / HR
  app.patch('/:cycleId/:employeeId/interview', { preHandler: requireRole('TEAM_HEAD', 'HR_ADMIN') }, async (req) => {
    const { cycleId, employeeId } = req.params as { cycleId: string; employeeId: string }
    const { note, done, scheduledAt, attendeeIds } = req.body as {
      note?: string; done?: boolean; scheduledAt?: string; attendeeIds?: string[]
    }

    const result = await prisma.result.update({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      data: {
        ...(note        !== undefined ? { interviewNote: note }                       : {}),
        ...(scheduledAt !== undefined ? { interviewScheduledAt: new Date(scheduledAt) } : {}),
        ...(done                      ? { interviewDoneAt: new Date() }               : {}),
      },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        cycle:    { select: { label: true } },
      },
    })

    // Send schedule notification + Google Calendar link to employee and attendees
    if (scheduledAt) {
      const dt    = new Date(scheduledAt)
      const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000) // +1 hour
      const fmt   = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(`Performance Interview — ${result.employee.fullName}`)}` +
        `&dates=${fmt(dt)}/${fmt(dtEnd)}` +
        `&details=${encodeURIComponent(`Performance review interview for ${result.cycle.label}.`)}` +
        `&add=${encodeURIComponent(result.employee.email)}`

      const notifyIds = [result.employee.id, ...(attendeeIds ?? [])]
      await notifyMany([...new Set(notifyIds)], {
        event:    'INTERVIEW_SCHEDULED',
        channels: ['EMAIL', 'IN_APP'],
        subject:  `Interview scheduled — ${result.employee.fullName} · ${result.cycle.label}`,
        body:     `A performance interview has been scheduled for <b>${dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>.<br/><a href="${gcalUrl}">Add to Google Calendar →</a>`,
      })
    }

    return result
  })

  // Save BU Head note — BU Head only
  app.patch('/:cycleId/:employeeId/bu-note', { preHandler: requireRole('BU_HEAD') }, async (req) => {
    const { cycleId, employeeId } = req.params as { cycleId: string; employeeId: string }
    const { note } = req.body as { note: string }
    return prisma.result.update({
      where: { cycleId_employeeId: { cycleId, employeeId } },
      data: { buNote: note },
    })
  })

  // Calculate consolidated scores for all employees with both evaluations submitted — HR only
  app.post('/calculate', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { cycleId } = req.body as { cycleId: string }
    const ready = await prisma.assignment.findMany({
      where: {
        cycleId,
        cycle: { submissions: { some: { type: 'EVAL_1', status: 'SUBMITTED' } } },
      },
      select: { employeeId: true },
    })
    // find employees who have both EVAL_1 and EVAL_2 submitted
    const e1Ids = new Set(
      (await prisma.submission.findMany({ where: { cycleId, type: 'EVAL_1', status: 'SUBMITTED' }, select: { employeeId: true } }))
        .map(s => s.employeeId)
    )
    const e2Ids = new Set(
      (await prisma.submission.findMany({ where: { cycleId, type: 'EVAL_2', status: 'SUBMITTED' }, select: { employeeId: true } }))
        .map(s => s.employeeId)
    )
    const bothDone = [...e1Ids].filter(id => e2Ids.has(id))
    const results = []
    for (const employeeId of bothDone) {
      try { results.push(await calculateResult(cycleId, employeeId)) } catch { /* skip */ }
    }
    return { calculated: results.length }
  })

  // Share consolidated results with employee + team head + BU head
  app.post('/share', { preHandler: requireRole('HR_ADMIN') }, async (req) => {
    const { cycleId, employeeIds } = req.body as { cycleId: string; employeeIds: string[] }
    const cycle = await prisma.reviewCycle.findUniqueOrThrow({ where: { id: cycleId } })
    const recipients = new Set<string>()

    for (const empId of employeeIds) {
      // Notify the employee themselves
      recipients.add(empId)
      const emp = await prisma.employee.findUnique({
        where: { id: empId },
        select: { bu: { select: { id: true } }, team: { select: { id: true } } },
      })
      if (emp?.bu?.id) {
        const buHead = await prisma.employee.findFirst({ where: { buId: emp.bu.id, role: 'BU_HEAD' } })
        if (buHead) recipients.add(buHead.id)
      }
      if (emp?.team?.id) {
        const teamHead = await prisma.employee.findFirst({ where: { teamId: emp.team.id, role: 'TEAM_HEAD' } })
        if (teamHead) recipients.add(teamHead.id)
      }
    }

    // Mark cycle results as released
    await prisma.reviewCycle.update({ where: { id: cycleId }, data: { resultsReleasedAt: new Date() } })

    await notifyMany([...recipients], {
      event: 'RESULTS_RELEASED', channels: ['EMAIL', 'IN_APP'],
      subject: `Evaluation results available — ${cycle.label}`,
      body: `The consolidated evaluation results for <b>${cycle.label}</b> are now available. Please log in to view.`,
    })

    return { notified: recipients.size }
  })

  // Performance Intelligence — multi-cycle employee comparison
  app.get('/analytics/intelligence', { preHandler: requireRole('HR_ADMIN', 'BU_HEAD', 'TEAM_HEAD') }, async (req) => {
    const { cycle1Id, cycle2Id } = req.query as { cycle1Id?: string; cycle2Id?: string }
    if (!cycle2Id) return []

    const [results2, results1] = await Promise.all([
      prisma.result.findMany({
        where: { cycleId: cycle2Id },
        include: {
          employee: {
            include: {
              bu:   { select: { name: true } },
              team: { select: { name: true } },
            },
          },
        },
      }),
      cycle1Id
        ? prisma.result.findMany({
            where: { cycleId: cycle1Id },
            select: { employeeId: true, performanceLabel: true },
          })
        : Promise.resolve([]),
    ])

    const map1 = new Map(results1.map(r => [r.employeeId, r.performanceLabel]))

    return results2.map(r => ({
      employeeId: r.employeeId,
      fullName:   r.employee.fullName,
      bu:         r.employee.bu?.name   ?? 'Unassigned',
      team:       r.employee.team?.name ?? null,
      grade:      r.employee.grade,
      label2:     r.performanceLabel,
      label1:     map1.get(r.employeeId) ?? null,
    }))
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
