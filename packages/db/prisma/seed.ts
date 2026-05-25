import { PrismaClient, Grade, SeniorityTier, Role } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Business Units
  const corporate = await prisma.businessUnit.upsert({
    where: { name: 'Corporate' },
    update: {},
    create: { name: 'Corporate' },
  })
  const sbu = await prisma.businessUnit.upsert({
    where: { name: 'Sustainability Business Unit' },
    update: {},
    create: { name: 'Sustainability Business Unit' },
  })
  const edm = await prisma.businessUnit.upsert({
    where: { name: 'Engineering, Design & Management' },
    update: {},
    create: { name: 'Engineering, Design & Management' },
  })

  // Teams
  const hrTeam = await prisma.team.upsert({
    where: { name_buId: { name: 'HR', buId: corporate.id } },
    update: {},
    create: { name: 'HR', buId: corporate.id },
  })
  const biodiversityTeam = await prisma.team.upsert({
    where: { name_buId: { name: 'Biodiversity', buId: sbu.id } },
    update: {},
    create: { name: 'Biodiversity', buId: sbu.id },
  })

  // HR Admin
  await prisma.employee.upsert({
    where: { email: 'hr@juru.org' },
    update: {},
    create: {
      juruId: 'HR00001',
      fullName: 'HR Administrator',
      email: 'hr@juru.org',
      grade: Grade.M1,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.HR_ADMIN,
      position: 'HR Manager',
      office: 'Tashkent',
      buId: corporate.id,
      teamId: hrTeam.id,
    },
  })

  // Sample BU Head
  await prisma.employee.upsert({
    where: { email: 'buhead@juru.org' },
    update: {},
    create: {
      juruId: 'BU00001',
      fullName: 'Diana Chen',
      email: 'buhead@juru.org',
      grade: Grade.D1,
      seniorityTier: SeniorityTier.SENIOR,
      role: Role.BU_HEAD,
      position: 'Business Unit Director',
      office: 'London',
      buId: sbu.id,
    },
  })

  // Sample Team Head
  await prisma.employee.upsert({
    where: { email: 'ta24084@juru.org' },
    update: {},
    create: {
      juruId: 'TA24084',
      fullName: 'Abdumalik Gayubov',
      email: 'ta24084@juru.org',
      grade: Grade.SC1,
      seniorityTier: SeniorityTier.MID,
      role: Role.TEAM_HEAD,
      position: 'Head of Biodiversity Team',
      office: 'Tashkent',
      buId: sbu.id,
      teamId: biodiversityTeam.id,
    },
  })

  // Sample Employee
  await prisma.employee.upsert({
    where: { email: 'ta25163@juru.org' },
    update: {},
    create: {
      juruId: 'TA25163',
      fullName: 'Aamir Sayeed',
      email: 'ta25163@juru.org',
      grade: Grade.C1,
      seniorityTier: SeniorityTier.ENTRY,
      role: Role.EMPLOYEE,
      position: 'Junior Biodiversity Specialist',
      office: 'Tashkent',
      buId: sbu.id,
      teamId: biodiversityTeam.id,
    },
  })

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
