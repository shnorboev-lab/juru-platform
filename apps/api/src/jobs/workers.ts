import { Worker } from 'bullmq'
import { connection } from './queues.js'
import { calculateResult } from '../services/scoring.js'
import { generateReport }  from '../services/reports.js'
import { notify }          from '../services/notify.js'

// Scoring worker
new Worker('scoring', async (job) => {
  const { cycleId, employeeId } = job.data
  const result = await calculateResult(cycleId, employeeId)
  console.log(`Scored ${employeeId} → ${result.performanceLabel} (avg ${result.overallAvg})`)

  // Notify at-risk
  if (result.isAtRisk) {
    const { prisma } = await import('@juru/db')
    const emp   = await prisma.employee.findUnique({ where: { id: employeeId } })
    const cycle = await prisma.reviewCycle.findUnique({
      where: { id: cycleId },
      include: { bu: { include: { head: true } } },
    })
    const teamHead = emp?.teamId
      ? await prisma.employee.findFirst({ where: { teamHeadOf: { some: { id: emp.teamId } } } })
      : null

    for (const head of [teamHead, cycle?.bu?.head].filter(Boolean)) {
      await notify({
        employeeId: head!.id,
        event:   'AT_RISK_FLAG',
        subject: `At-Risk Flag: ${emp?.fullName}`,
        body:    `${emp?.fullName} (${emp?.grade}) has been flagged as at-risk in the <b>${cycle?.label}</b> cycle with ${result.belowCount} sub-criteria below expectations.`,
        channels: ['EMAIL', 'GCHAT'],
      })
    }
  }
}, { connection })

// Report worker
new Worker('reports', async (job) => {
  const { reportId, cycleId } = job.data
  await generateReport(reportId, cycleId)
}, { connection })

console.log('BullMQ workers started')
