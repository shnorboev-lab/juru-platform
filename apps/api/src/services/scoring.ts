import { prisma, PerformanceLabel, SubCriterion, SeniorityTier } from '@juru/db'

function toLabel(avg: number): PerformanceLabel {
  if (avg >= 4.5) return PerformanceLabel.EXCEPTIONAL
  if (avg >= 3.5) return PerformanceLabel.EXCEEDS_EXPECTATIONS
  if (avg >= 2.5) return PerformanceLabel.MEETS_EXPECTATIONS
  if (avg >= 1.5) return PerformanceLabel.PARTIALLY_MEETS
  return PerformanceLabel.BELOW_EXPECTATIONS
}

function isAtRiskByTier(tier: SeniorityTier, belowCount: number): boolean {
  if (tier === SeniorityTier.ENTRY)  return belowCount > 3
  if (tier === SeniorityTier.MID)    return belowCount > 2
  return belowCount > 1  // SENIOR
}

export async function calculateResult(cycleId: string, employeeId: string) {
  const assignment = await prisma.assignment.findUniqueOrThrow({
    where: { cycleId_employeeId: { cycleId, employeeId } },
  })

  const [sub1, sub2] = await Promise.all([
    prisma.submission.findUniqueOrThrow({
      where: { cycleId_employeeId_type: { cycleId, employeeId, type: 'EVAL_1' } },
      include: { scores: true },
    }),
    prisma.submission.findUniqueOrThrow({
      where: { cycleId_employeeId_type: { cycleId, employeeId, type: 'EVAL_2' } },
      include: { scores: true },
    }),
  ])

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } })

  const criteria = Object.values(SubCriterion)
  const subResults: { subCriterion: SubCriterion; scoreE1: number; scoreE2: number; weightedScore: number }[] = []

  let totalWeighted = 0
  let belowCount    = 0

  for (const sc of criteria) {
    const s1 = sub1.scores.find(s => s.subCriterion === sc)?.score ?? 0
    const s2 = sub2.scores.find(s => s.subCriterion === sc)?.score ?? 0
    const weighted = s1 * Number(assignment.weight1) + s2 * Number(assignment.weight2)
    totalWeighted += weighted
    if (weighted < 1.5) belowCount++
    subResults.push({ subCriterion: sc, scoreE1: s1, scoreE2: s2, weightedScore: weighted })
  }

  const overallAvg = totalWeighted / criteria.length
  const performanceLabel = toLabel(overallAvg)
  const isAtRisk    = isAtRiskByTier(employee.seniorityTier, belowCount)
  const isNominated = overallAvg >= 4.0

  const result = await prisma.result.upsert({
    where: { cycleId_employeeId: { cycleId, employeeId } },
    update: { overallAvg, performanceLabel, isAtRisk, isNominated, belowCount },
    create: {
      cycleId, employeeId,
      overallAvg, performanceLabel, isAtRisk, isNominated, belowCount,
    },
  })

  // Write sub-criterion breakdown
  await prisma.subCriterionResult.deleteMany({ where: { resultId: result.id } })
  await prisma.subCriterionResult.createMany({
    data: subResults.map(sr => ({ ...sr, resultId: result.id })),
  })

  return result
}
