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

  // Deadline reminders — every 3 days at 9:00 AM (days 1,4,7,10,… of month + Mon/Thu/Sun pattern)
  // Achieved by running daily but only sending if last DEADLINE_REMINDER for that employee was 3+ days ago
  cron.schedule('0 9 * * *', async () => {
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000
    const cutoff        = new Date(Date.now() - THREE_DAYS_MS)

    const activeCycles = await prisma.reviewCycle.findMany({
      where: { phase: { in: [CyclePhase.SELF_APPRAISAL, CyclePhase.EVALUATION, CyclePhase.INTERVIEW] } },
    })

    for (const cycle of activeCycles) {
      if (cycle.phase === CyclePhase.SELF_APPRAISAL) {
        const submitted = await prisma.submission.findMany({
          where: { cycleId: cycle.id, type: 'SELF', status: 'SUBMITTED' },
          select: { employeeId: true },
        })
        const submittedIds = new Set(submitted.map(s => s.employeeId))
        const assignments  = await prisma.assignment.findMany({ where: { cycleId: cycle.id } })
        const pending = assignments
          .filter((a: { employeeId: string }) => !submittedIds.has(a.employeeId))
          .map((a: { employeeId: string }) => a.employeeId)

        // Filter to those who haven't been reminded in the last 3 days
        const toNotify: string[] = []
        for (const empId of pending) {
          const last = await prisma.notification.findFirst({
            where: { employeeId: empId, event: 'DEADLINE_REMINDER', createdAt: { gte: cutoff } },
          })
          if (!last) toNotify.push(empId)
        }

        if (toNotify.length) {
          await notifyMany(toNotify, {
            event:    'DEADLINE_REMINDER',
            subject:  `Reminder: Complete your self-appraisal — ${cycle.label}`,
            body:     `Your self-appraisal for <b>${cycle.label}</b> is pending. Please complete it by <b>${cycle.selfAppraisalEnd.toDateString()}</b>.`,
            channels: ['EMAIL', 'IN_APP'],
          })
        }
      }

      if (cycle.phase === CyclePhase.EVALUATION) {
        const assignments = await prisma.assignment.findMany({ where: { cycleId: cycle.id } })
        const pendingEvaluators = new Set<string>()

        for (const a of assignments as { employeeId: string; evaluator1Id: string; evaluator2Id: string }[]) {
          const [e1, e2] = await Promise.all([
            prisma.submission.findUnique({ where: { cycleId_employeeId_type: { cycleId: cycle.id, employeeId: a.employeeId, type: 'EVAL_1' } } }),
            prisma.submission.findUnique({ where: { cycleId_employeeId_type: { cycleId: cycle.id, employeeId: a.employeeId, type: 'EVAL_2' } } }),
          ])
          if (!e1 || e1.status === 'DRAFT') pendingEvaluators.add(a.evaluator1Id)
          if (!e2 || e2.status === 'DRAFT') pendingEvaluators.add(a.evaluator2Id)
        }

        const toNotify: string[] = []
        for (const empId of pendingEvaluators) {
          const last = await prisma.notification.findFirst({
            where: { employeeId: empId, event: 'DEADLINE_REMINDER', createdAt: { gte: cutoff } },
          })
          if (!last) toNotify.push(empId)
        }

        if (toNotify.length) {
          await notifyMany(toNotify, {
            event:    'DEADLINE_REMINDER',
            subject:  `Reminder: Complete your evaluations — ${cycle.label}`,
            body:     `You have pending evaluations for <b>${cycle.label}</b>. Please complete them by <b>${cycle.evaluationEnd.toDateString()}</b>.`,
            channels: ['EMAIL', 'IN_APP'],
          })
        }
      }

      if (cycle.phase === CyclePhase.INTERVIEW) {
        // Remind team heads to complete pending interviews
        const pendingInterviews = await prisma.result.findMany({
          where: { cycleId: cycle.id, interviewDoneAt: null },
          include: { employee: { select: { teamId: true } } },
        })

        const teamHeadIds = new Set<string>()
        for (const r of pendingInterviews) {
          if (r.employee.teamId) {
            const head = await prisma.employee.findFirst({ where: { role: 'TEAM_HEAD', teamId: r.employee.teamId } })
            if (head) teamHeadIds.add(head.id)
          }
        }

        const toNotify: string[] = []
        for (const empId of teamHeadIds) {
          const last = await prisma.notification.findFirst({
            where: { employeeId: empId, event: 'DEADLINE_REMINDER', createdAt: { gte: cutoff } },
          })
          if (!last) toNotify.push(empId)
        }

        if (toNotify.length) {
          await notifyMany(toNotify, {
            event:    'DEADLINE_REMINDER',
            subject:  `Reminder: Complete pending interviews — ${cycle.label}`,
            body:     `You have pending performance interviews for <b>${cycle.label}</b>. Please complete them by <b>${cycle.interviewEnd.toDateString()}</b>.`,
            channels: ['EMAIL', 'IN_APP'],
          })
        }
      }
    }
  })

  console.log('[Scheduler] Cron jobs registered')
}
