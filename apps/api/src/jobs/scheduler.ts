import cron from 'node-cron'
import { prisma, CyclePhase } from '@juru/db'
import { notify, notifyMany } from '../services/notify.js'

export function startScheduler() {
  // Phase auto-transitions — run at 00:01 every day
  cron.schedule('1 0 * * *', async () => {
    const now   = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const activeCycles = await prisma.reviewCycle.findMany({
      where: { phase: { not: CyclePhase.DONE } },
    })

    for (const cycle of activeCycles) {
      let newPhase: CyclePhase | null = null

      if (today >= cycle.selfAppraisalStart && cycle.phase === CyclePhase.PREP) {
        newPhase = CyclePhase.SELF_APPRAISAL
      } else if (today >= cycle.selfAppraisalStart && cycle.phase === CyclePhase.SELF_APPRAISAL) {
        // Evaluation runs in parallel — no phase change needed, just also opens eval
      } else if (today > cycle.selfAppraisalEnd && cycle.phase === CyclePhase.SELF_APPRAISAL) {
        newPhase = CyclePhase.EVALUATION
      } else if (today > cycle.evaluationEnd && cycle.phase === CyclePhase.EVALUATION) {
        newPhase = CyclePhase.CONSOLIDATION
      } else if (today > cycle.consolidationEnd && cycle.phase === CyclePhase.CONSOLIDATION) {
        newPhase = CyclePhase.INTERVIEW
      } else if (today > cycle.interviewEnd && cycle.phase === CyclePhase.INTERVIEW) {
        newPhase = CyclePhase.DONE
      }

      if (newPhase) {
        await prisma.reviewCycle.update({ where: { id: cycle.id }, data: { phase: newPhase } })
        console.log(`[Scheduler] Cycle ${cycle.label} → ${newPhase}`)
      }
    }
  })

  // Deadline reminders — daily at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    const activeCycles = await prisma.reviewCycle.findMany({
      where: { phase: { in: [CyclePhase.SELF_APPRAISAL, CyclePhase.EVALUATION] } },
    })

    for (const cycle of activeCycles) {
      if (cycle.phase === CyclePhase.SELF_APPRAISAL) {
        // Find employees who haven't submitted self-appraisal
        const submitted = await prisma.submission.findMany({
          where: { cycleId: cycle.id, type: 'SELF', status: 'SUBMITTED' },
          select: { employeeId: true },
        })
        const submittedIds = new Set(submitted.map(s => s.employeeId))
        const assignments  = await prisma.assignment.findMany({ where: { cycleId: cycle.id } })
        const pending = assignments.filter((a: { employeeId: string }) => !submittedIds.has(a.employeeId)).map((a: { employeeId: string }) => a.employeeId)

        await notifyMany(pending, {
          event:   'DEADLINE_REMINDER',
          subject: `Reminder: Complete your self-appraisal — ${cycle.label}`,
          body:    `Your self-appraisal for <b>${cycle.label}</b> is pending. Please complete it by <b>${cycle.selfAppraisalEnd.toDateString()}</b>.`,
          channels: ['EMAIL', 'IN_APP'],
        })
      }

      if (cycle.phase === CyclePhase.EVALUATION) {
        // Remind evaluators with pending submissions
        const assignments = await prisma.assignment.findMany({ where: { cycleId: cycle.id } })
        const pendingEval1: string[] = []
        const pendingEval2: string[] = []

        for (const a of assignments as { employeeId: string; evaluator1Id: string; evaluator2Id: string }[]) {
          const e1 = await prisma.submission.findUnique({
            where: { cycleId_employeeId_type: { cycleId: cycle.id, employeeId: a.employeeId, type: 'EVAL_1' } },
          })
          const e2 = await prisma.submission.findUnique({
            where: { cycleId_employeeId_type: { cycleId: cycle.id, employeeId: a.employeeId, type: 'EVAL_2' } },
          })
          if (!e1 || e1.status === 'DRAFT') pendingEval1.push(a.evaluator1Id)
          if (!e2 || e2.status === 'DRAFT') pendingEval2.push(a.evaluator2Id)
        }

        const uniqueEval1 = [...new Set(pendingEval1)]
        const uniqueEval2 = [...new Set(pendingEval2)]

        await notifyMany([...new Set([...uniqueEval1, ...uniqueEval2])], {
          event:   'DEADLINE_REMINDER',
          subject: `Reminder: Complete your evaluations — ${cycle.label}`,
          body:    `You have pending evaluations for <b>${cycle.label}</b>. Please complete them by <b>${cycle.evaluationEnd.toDateString()}</b>.`,
          channels: ['EMAIL', 'IN_APP'],
        })
      }
    }
  })

  console.log('[Scheduler] Cron jobs registered')
}
