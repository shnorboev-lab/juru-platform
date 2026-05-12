import { prisma, Grade, SeniorityTier, Role, CycleType, CyclePhase } from './index'

function seniorityFor(grade: Grade): SeniorityTier {
  const entry = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4','I']
  const mid   = ['SE1','SE2','SE3','SE4','SC1','SC2','SC3','SC4']
  if (entry.includes(grade)) return SeniorityTier.ENTRY
  if (mid.includes(grade))   return SeniorityTier.MID
  return SeniorityTier.SENIOR
}

async function main() {
  // Business Units
  const sbu = await prisma.businessUnit.upsert({
    where: { name: 'Sustainability Business Unit' },
    update: {},
    create: { name: 'Sustainability Business Unit' },
  })

  // Teams
  const energyTeam = await prisma.team.upsert({
    where: { buId_name: { buId: sbu.id, name: 'Energy Advisory' } },
    update: {},
    create: { name: 'Energy Advisory', buId: sbu.id },
  })
  const climateTeam = await prisma.team.upsert({
    where: { buId_name: { buId: sbu.id, name: 'Climate Finance' } },
    update: {},
    create: { name: 'Climate Finance', buId: sbu.id },
  })

  // MD
  const md = await prisma.employee.upsert({
    where: { email: 'md@juru.org' },
    update: { role: Role.MD },
    create: {
      fullName: 'Michael Dawson',
      email: 'md@juru.org',
      grade: Grade.MD,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.MD,
      buId: sbu.id,
    },
  })

  // BU Head
  const buHead = await prisma.employee.upsert({
    where: { email: 'buhead@juru.org' },
    update: { role: Role.BU_HEAD },
    create: {
      fullName: 'Diana Chen',
      email: 'buhead@juru.org',
      grade: Grade.D1,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.BU_HEAD,
      buId: sbu.id,
    },
  })

  // Team Head
  const teamHead = await prisma.employee.upsert({
    where: { email: 'teamhead@juru.org' },
    update: { role: Role.TEAM_HEAD },
    create: {
      fullName: 'Tom Rivera',
      email: 'teamhead@juru.org',
      grade: Grade.SM1,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.TEAM_HEAD,
      teamId: energyTeam.id,
      buId: sbu.id,
    },
  })

  // HR Admin
  const hr = await prisma.employee.upsert({
    where: { email: 'hr@juru.org' },
    update: {},
    create: {
      fullName: 'Sara HR',
      email: 'hr@juru.org',
      grade: Grade.M1,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.HR_ADMIN,
      buId: sbu.id,
    },
  })

  // Evaluators
  const eval1 = await prisma.employee.upsert({
    where: { email: 'bob@juru.org' },
    update: {},
    create: {
      fullName: 'Bob Smith',
      email: 'bob@juru.org',
      grade: Grade.PE,
      seniorityTier: seniorityFor(Grade.PE),
      role: Role.EVALUATOR,
      teamId: energyTeam.id,
      buId: sbu.id,
    },
  })

  const eval2 = await prisma.employee.upsert({
    where: { email: 'carol@juru.org' },
    update: {},
    create: {
      fullName: 'Carol Davis',
      email: 'carol@juru.org',
      grade: Grade.M1,
      seniorityTier: seniorityFor(Grade.M1),
      role: Role.EVALUATOR,
      teamId: climateTeam.id,
      buId: sbu.id,
    },
  })

  // Employees
  const employees = [
    { email: 'alice@juru.org',   fullName: 'Alice Johnson',  grade: Grade.SE1 },
    { email: 'james@juru.org',   fullName: 'James Park',     grade: Grade.S2  },
    { email: 'nina@juru.org',    fullName: 'Nina Okafor',    grade: Grade.E3  },
    { email: 'lucas@juru.org',   fullName: 'Lucas Moreau',   grade: Grade.SC2 },
    { email: 'priya@juru.org',   fullName: 'Priya Menon',    grade: Grade.SE3 },
    { email: 'omar@juru.org',    fullName: 'Omar Hassan',    grade: Grade.C3  },
  ]
  const empRecords = []
  for (const e of employees) {
    const rec = await prisma.employee.upsert({
      where: { email: e.email },
      update: {},
      create: {
        fullName: e.fullName,
        email: e.email,
        grade: e.grade,
        seniorityTier: seniorityFor(e.grade),
        role: Role.EMPLOYEE,
        teamId: energyTeam.id,
        buId: sbu.id,
      },
    })
    empRecords.push(rec)
  }

  // Set BU head
  await prisma.businessUnit.update({ where: { id: sbu.id }, data: { headId: buHead.id } })
  // Set team head
  await prisma.team.update({ where: { id: energyTeam.id }, data: { headId: teamHead.id } })

  // Review Cycle (in SELF_APPRAISAL phase so employees can immediately submit)
  const cycle = await prisma.reviewCycle.upsert({
    where: { type_year_buId: { type: CycleType.SEMI_ANNUAL, year: 2026, buId: sbu.id } },
    update: { phase: CyclePhase.SELF_APPRAISAL },
    create: {
      type: CycleType.SEMI_ANNUAL,
      year: 2026,
      label: 'Semi-Annual 2026 — SBU',
      buId: sbu.id,
      phase: CyclePhase.SELF_APPRAISAL,
      selfAppraisalStart: new Date('2026-05-01'),
      selfAppraisalEnd:   new Date('2026-06-01'),
      evaluationEnd:      new Date('2026-06-15'),
      consolidationEnd:   new Date('2026-06-20'),
      interviewEnd:       new Date('2026-06-30'),
    },
  })

  // Assignments: eval1 (70%) and eval2 (30%) for all employees
  for (const emp of empRecords) {
    await prisma.assignment.upsert({
      where: { cycleId_employeeId: { cycleId: cycle.id, employeeId: emp.id } },
      update: {},
      create: {
        cycleId: cycle.id,
        employeeId: emp.id,
        evaluator1Id: eval1.id,
        evaluator2Id: eval2.id,
        weight1: 0.70,
        weight2: 0.30,
      },
    })
  }

  console.log('Seed complete ✓')
  console.log('Login accounts:')
  console.log('  hr@juru.org       — HR Admin')
  console.log('  alice@juru.org    — Employee (SE1)')
  console.log('  bob@juru.org      — Evaluator (PE)')
  console.log('  teamhead@juru.org — Team Head (SM1)')
  console.log('  buhead@juru.org   — BU Head (D1)')
  console.log('  md@juru.org       — MD')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
