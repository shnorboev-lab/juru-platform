/**
 * Import historical FY2025 Annual + FY2026 Semi-Annual performance data
 * Run: cd packages/db && npx tsx prisma/import-historical.ts
 */
import { PrismaClient, Grade, SeniorityTier, Role, CyclePhase, CycleType, PerformanceLabel } from '@prisma/client'

const prisma = new PrismaClient()

// ── Employee data from FY2025 / FY2026 review cycles ─────────────────────────
// f25 / f26: BE | PM | ME | EE | EX | LEFT | MOVED | - (no prior data)
const ALL_EMP = [
  // ── SBU ──────────────────────────────────────────────────────────────────
  { n:'Karolina Sulitanofu',             bu:'SBU', f25:'ME', f26:'PM' },
  { n:'Anna Ten',                        bu:'SBU', f25:'EE', f26:'ME' },
  { n:'Maxim Koshkin',                   bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Aleksandr Matsyna',               bu:'SBU', f25:'EE', f26:'ME' },
  { n:'Polina Smagina',                  bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Shukhrat Sharaimov',              bu:'SBU', f25:'EE', f26:'EE' },
  { n:'Erik Salimov',                    bu:'SBU', f25:'ME', f26:'PM' },
  { n:'Dinara Adilova',                  bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Oleg Khegay',                     bu:'SBU', f25:'ME', f26:'PM' },
  { n:'Dinora Rustami',                  bu:'SBU', f25:'EE', f26:'ME' },
  { n:'Danila Avdulov',                  bu:'SBU', f25:'PM', f26:'EE' },
  { n:'Marina Shiriaeva',                bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Umsunay Nurmanova',               bu:'SBU', f25:'PM', f26:'PM' },
  { n:'Nigina Ismatova',                 bu:'SBU', f25:'-',  f26:'ME' },
  { n:'Marva Ismatullo',                 bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Gulchekhra Nematullaeva',         bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Mukhtaram Burieva',               bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Zilola Kazakova',                 bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Zukhra Sultanova',                bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Muzaffarbek Salimov',             bu:'SBU', f25:'PM', f26:'PM' },
  { n:'Iroda Malikova',                  bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Mokhinur Zokirova',               bu:'SBU', f25:'EE', f26:'EE' },
  { n:'Zarina Gafurova',                 bu:'SBU', f25:'ME', f26:'EE' },
  { n:'Yulduz Yusupova',                 bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Shakhnoza Khamraeva',             bu:'SBU', f25:'ME', f26:'EE' },
  { n:'Bekhruz Erbaev',                  bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Murodjon Berdimurodov',           bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Kuvonchbek Kuchkorov',            bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Dinara Beisekova',                bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Ulugbek Makhammetov',             bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Akmal Kilichev',                  bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Anatoliy Dementev',               bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Marat Otajanov',                  bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Oybek Rajabov',                   bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Ilkhamdjan Karshiev',             bu:'SBU', f25:'PM', f26:'ME' },
  { n:'Viktoriya Filatova',              bu:'SBU', f25:'ME', f26:'ME' },
  { n:'Lazizbek Rakhimov',               bu:'SBU', f25:'PM', f26:'PM' },
  // ── EC ───────────────────────────────────────────────────────────────────
  { n:'Bekhzod Mukhamadiev',             bu:'EC',  f25:'ME', f26:'PM'   },
  { n:'Madiyar Urazov',                  bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Biloliddin Ansoriddinov',         bu:'EC',  f25:'ME', f26:'LEFT' },
  { n:'Eldar Guliev',                    bu:'EC',  f25:'-',  f26:'EE'   },
  { n:'Firdavsjon Mukhiddinov',          bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Farkhodbek Mamadjanov',           bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Jasur Khodjiev',                  bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Shakhzodbek Samandarov',          bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Asalkhon Norkhujaeva',            bu:'EC',  f25:'ME', f26:'-'    },
  { n:'Daulet Shantuov',                 bu:'EC',  f25:'ME', f26:'EE'   },
  { n:'Akbar Ruziev',                    bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Dinara Adkhamova',                bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Ilia Gusev',                      bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Bahora Sobirjonova',              bu:'EC',  f25:'ME', f26:'-'    },
  { n:'Fazliddin Choriev',               bu:'EC',  f25:'ME', f26:'EE'   },
  { n:'Bekjon Makhmudov',                bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Angelina Shmakova',               bu:'EC',  f25:'ME', f26:'LEFT' },
  { n:'Rustam Abdurazakov',              bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Saodat Goyibova',                 bu:'EC',  f25:'PM', f26:'PM'   },
  { n:'Mirshokhid Samadov',              bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'TemurMalik Mirzaabdullaev',       bu:'EC',  f25:'ME', f26:'PM'   },
  { n:'Akmal Rakhmatkhodjaev',           bu:'EC',  f25:'EE', f26:'ME'   },
  { n:'Shokhrukh Turgunbaev',            bu:'EC',  f25:'ME', f26:'PM'   },
  { n:'Abdumalik Gayubov',               bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Rinat Ruzmamatov',                bu:'EC',  f25:'ME', f26:'PM'   },
  { n:'Enver Bekirov',                   bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Maruf Boshmanov',                 bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Doniyor Avizov',                  bu:'EC',  f25:'PM', f26:'PM'   },
  { n:'Dilshod Narimov',                 bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Umidbek Murodov',                 bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Sanjar Rahimov',                  bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Alexandr Gavrish',                bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Fakhriddin Khasanov',             bu:'EC',  f25:'ME', f26:'EE'   },
  { n:'Abdusamad Abdurashidov',          bu:'EC',  f25:'ME', f26:'EE'   },
  { n:'Takhir Urazimbetov',              bu:'EC',  f25:'EE', f26:'EE'   },
  { n:'Temurkhan Ikramov',               bu:'EC',  f25:'EE', f26:'ME'   },
  { n:'Asilbek Kosbergenov',             bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Inokbek Ismoilov',                bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Adilbek Tashmetov',               bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Davron Saparaliev',               bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Sultanbek Omirbaev',              bu:'EC',  f25:'ME', f26:'ME'   },
  { n:'Khabibullo Negmatullaev',         bu:'EC',  f25:'PM', f26:'PM'   },
  // ── EDM ──────────────────────────────────────────────────────────────────
  { n:'Mukhiddin Ertaev',                bu:'EDM', f25:'PM', f26:'PM'   },
  { n:'Ulugbek Zokirov',                 bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Sanjar Rozikov',                  bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Evgeniy Sagdullaev',              bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Alisher Tursunov',                bu:'EDM', f25:'-',  f26:'PM'   },
  { n:'Temur Madirimov',                 bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Ulugbek Mamasoliev',              bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Akram Nasimov',                   bu:'EDM', f25:'ME', f26:'PM'   },
  { n:'Ekaterina Lan',                   bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Shakhnoza Fayzullaeva',           bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Diana Shukurova',                 bu:'EDM', f25:'EX', f26:'ME'   },
  { n:'Artur Bakhmurtov',                bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Alina Muratova',                  bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Sardor Egamberdiev',              bu:'EDM', f25:'ME', f26:'PM'   },
  { n:'Sergei Sidorov',                  bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Hamed Arjmandi',                  bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Maksym Sorokin',                  bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Valery Beniash',                  bu:'EDM', f25:'ME', f26:'LEFT' },
  { n:'Asilbek Mavlyanov',               bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Temurmalik Amirov',               bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Albina Garifullina',              bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Ilya Karpov',                     bu:'EDM', f25:'ME', f26:'PM'   },
  { n:'Nazira Galimova',                 bu:'EDM', f25:'PM', f26:'EE'   },
  { n:'Atabek Ismandiyarov',             bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Bobokhon Babadjonov',             bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Tokhir Kholmirzaev',              bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Khasan Nigorov',                  bu:'EDM', f25:'ME', f26:'PM'   },
  { n:'Jasurbek Arziev',                 bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Sirojiddin Berdiyorov',           bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Anastasiya Salnikova',            bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Muzaffar Khabibjonov',            bu:'EDM', f25:'EE', f26:'EE'   },
  { n:'Mukhammadali Isoev',              bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Akhmed Jalgasov',                 bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Bekhruz Bozarov',                 bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Saidkhon Davronov',               bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Nursultan Kuptleuov',             bu:'EDM', f25:'ME', f26:'PM'   },
  { n:'Sarvar Sayitkarimov',             bu:'EDM', f25:'EE', f26:'ME'   },
  { n:'Botir Aliev',                     bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Dmitriy Zublev',                  bu:'EDM', f25:'ME', f26:'EE'   },
  { n:'Ivan Burdukov',                   bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Yuliya Tyurina',                  bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Bakhitjon Erkinov',               bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Avazkhon Ishankhanov',            bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Ivan Petrikhin',                  bu:'EDM', f25:'EE', f26:'EE'   },
  { n:'Murodjan Yuldashev',              bu:'EDM', f25:'ME', f26:'LEFT' },
  { n:'Mirkhalil Zakirov',               bu:'EDM', f25:'ME', f26:'LEFT' },
  { n:'Azimkhuja Azamatov',              bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Javokhir Abdunabiev',             bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Otabek Ungiev',                   bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Rustam Muradov',                  bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Anatoliy Polstyanov',             bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Vitaliy Sadretdinov',             bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Feruza Nazarova',                 bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Mustafa Bekirov',                 bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Sherzod Salimov',                 bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Shahodat Kholova',                bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Saydiolimkhon Abdusattarkhuja',   bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Sergey Saklakov',                 bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Vadim Shegay',                    bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Ramil Valitov',                   bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Ramziddin Shayunusov',            bu:'EDM', f25:'BE', f26:'LEFT' },
  { n:'Oybek Bakhtiyorov',               bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Bilol Islomov',                   bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Aleksei Kornienko',               bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Elbek Mukhhammadiev',             bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Saidazimkhon Kodirkhonov',        bu:'EDM', f25:'BE', f26:'LEFT' },
  { n:'Mirakbar Samatov',                bu:'EDM', f25:'PM', f26:'MOVED'},
  { n:'Sangin Azmetov',                  bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Aamir Sayeed',                    bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Islom Karimov',                   bu:'EDM', f25:'PM', f26:'ME'   },
  { n:'Adilbek Salibaev',                bu:'EDM', f25:'ME', f26:'LEFT' },
  { n:'Shukhrat Sagdullaev',             bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Oybek Fayziev',                   bu:'EDM', f25:'PM', f26:'LEFT' },
  { n:'Azizbek Begdullaev',              bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Maryam Abduvalieva',              bu:'EDM', f25:'ME', f26:'ME'   },
  { n:'Akhmadjon Mamadjanov',            bu:'EDM', f25:'PM', f26:'PM'   },
  { n:'Mirgani Abdullaev',               bu:'EDM', f25:'-',  f26:'ME'   },
  // ── Corporate ────────────────────────────────────────────────────────────
  { n:'Jushkinbek Ismailov',             bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Jakhongir Yakubov',               bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Jakhongir Egamberganov',          bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Tokhir Djabbarov',                bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Soatmurot Mamadiyorov',           bu:'Corporate', f25:'ME', f26:'ME' },
  { n:'Hamidulla Sapaev',                bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Dildora Abdumalikova',            bu:'Corporate', f25:'PM', f26:'ME' },
  { n:'Abdulaziz Janturaev',             bu:'Corporate', f25:'ME', f26:'ME' },
  { n:'Sherzodbek Norboev',              bu:'Corporate', f25:'-',  f26:'PM' },
  { n:'Nigora Karshieva',                bu:'Corporate', f25:'ME', f26:'PM' },
  { n:'Parizoda Ruzieva',                bu:'Corporate', f25:'PM', f26:'ME' },
  { n:'Nargiza Khamidova',               bu:'Corporate', f25:'PM', f26:'PM' },
  { n:'Evgeniy Pak',                     bu:'Corporate', f25:'PM', f26:'ME' },
  { n:'Sukhrobjon Shomurotov',           bu:'Corporate', f25:'ME', f26:'ME' },
  { n:'Dostonbek Bakhtiyorov',           bu:'Corporate', f25:'PM', f26:'ME' },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID = new Set(['EX','EE','ME','PM','BE'])

const CODE_TO_LABEL: Record<string, PerformanceLabel> = {
  EX: PerformanceLabel.EXCEPTIONAL,
  EE: PerformanceLabel.EXCEEDS_EXPECTATIONS,
  ME: PerformanceLabel.MEETS_EXPECTATIONS,
  PM: PerformanceLabel.PARTIALLY_MEETS,
  BE: PerformanceLabel.BELOW_EXPECTATIONS,
}

const CODE_TO_AVG: Record<string, number> = {
  EX: 4.75, EE: 4.0, ME: 3.0, PM: 2.0, BE: 1.2,
}

function gradeFor(code: string): { grade: Grade; seniorityTier: SeniorityTier } {
  if (code === 'EX')        return { grade: Grade.M2,  seniorityTier: SeniorityTier.SENIOR }
  if (code === 'EE')        return { grade: Grade.SE2, seniorityTier: SeniorityTier.MID    }
  if (code === 'PM' || code === 'BE') return { grade: Grade.E3, seniorityTier: SeniorityTier.ENTRY }
  return { grade: Grade.C3, seniorityTier: SeniorityTier.ENTRY }
}

function slugEmail(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .trim()
    .replace(/\s+/g, '.')
    + '@juru.org'
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Juru Historical Data Import ===\n')

  // ── 1. Business Units ──────────────────────────────────────────────────────
  console.log('1. Upserting business units...')
  const BU_NAMES = ['SBU', 'EC', 'EDM', 'Corporate'] as const
  const buMap: Record<string, string> = {}
  for (const name of BU_NAMES) {
    const bu = await prisma.businessUnit.upsert({
      where:  { name },
      create: { name },
      update: {},
    })
    buMap[name] = bu.id
    console.log(`   ${name} → ${bu.id}`)
  }

  // ── 2. Employees ───────────────────────────────────────────────────────────
  console.log('\n2. Creating employees...')
  const empMap: Record<string, string> = {} // fullName → id
  const usedEmails = new Set<string>()

  for (const row of ALL_EMP) {
    const buId = buMap[row.bu]
    if (!buId) { console.warn(`   SKIP unknown BU: ${row.bu}`); continue }

    // Resolve email (deduplicate)
    let email = slugEmail(row.n)
    let suffix = 2
    while (usedEmails.has(email)) {
      const [local, domain] = email.split('@')
      email = `${local}${suffix}@${domain}`
      suffix++
    }
    usedEmails.add(email)

    const isActive = row.f26 !== 'LEFT' && row.f26 !== 'MOVED'
    const repCode  = VALID.has(row.f26) ? row.f26 : VALID.has(row.f25) ? row.f25 : 'ME'
    const { grade, seniorityTier } = gradeFor(repCode)

    const emp = await prisma.employee.upsert({
      where:  { email },
      create: { email, fullName: row.n, grade, seniorityTier, role: Role.EMPLOYEE, buId, isActive },
      update: { fullName: row.n, buId, isActive },
    })
    empMap[row.n] = emp.id
  }
  console.log(`   Created/updated ${Object.keys(empMap).length} employees`)

  // ── 3. Review Cycles (one per BU per cycle-type) ───────────────────────────
  console.log('\n3. Creating review cycles...')

  const cyc25Map: Record<string, string> = {}
  const cyc26Map: Record<string, string> = {}

  for (const buName of BU_NAMES) {
    const buId = buMap[buName]

    const c25 = await prisma.reviewCycle.upsert({
      where:  { type_year_buId: { type: CycleType.ANNUAL, year: 2025, buId } },
      create: {
        type: CycleType.ANNUAL, year: 2025,
        label: `FY2025 Annual Review — ${buName}`,
        buId,
        phase:              CyclePhase.DONE,
        selfAppraisalStart: new Date('2025-01-06'),
        selfAppraisalEnd:   new Date('2025-01-20'),
        evaluationEnd:      new Date('2025-02-10'),
        consolidationEnd:   new Date('2025-02-20'),
        interviewEnd:       new Date('2025-03-07'),
        resultsReleasedAt:  new Date('2025-03-15'),
      },
      update: { phase: CyclePhase.DONE, resultsReleasedAt: new Date('2025-03-15') },
    })
    cyc25Map[buName] = c25.id
    console.log(`   FY2025 Annual — ${buName} → ${c25.id}`)

    const c26 = await prisma.reviewCycle.upsert({
      where:  { type_year_buId: { type: CycleType.SEMI_ANNUAL, year: 2026, buId } },
      create: {
        type: CycleType.SEMI_ANNUAL, year: 2026,
        label: `FY2026 Semi-Annual Review — ${buName}`,
        buId,
        phase:              CyclePhase.DONE,
        selfAppraisalStart: new Date('2026-01-06'),
        selfAppraisalEnd:   new Date('2026-01-20'),
        evaluationEnd:      new Date('2026-02-10'),
        consolidationEnd:   new Date('2026-02-20'),
        interviewEnd:       new Date('2026-03-07'),
        resultsReleasedAt:  new Date('2026-03-15'),
      },
      update: { phase: CyclePhase.DONE, resultsReleasedAt: new Date('2026-03-15') },
    })
    cyc26Map[buName] = c26.id
    console.log(`   FY2026 Semi-Annual — ${buName} → ${c26.id}`)
  }

  // ── 4. Results ──────────────────────────────────────────────────────────────
  console.log('\n4. Creating results...')
  let created = 0, skipped = 0

  for (const row of ALL_EMP) {
    const employeeId = empMap[row.n]
    if (!employeeId) { skipped++; continue }

    // FY2025 result
    if (VALID.has(row.f25)) {
      const cycleId = cyc25Map[row.bu]
      if (cycleId) {
        await prisma.result.upsert({
          where:  { cycleId_employeeId: { cycleId, employeeId } },
          create: {
            cycleId, employeeId,
            overallAvg:       CODE_TO_AVG[row.f25],
            performanceLabel: CODE_TO_LABEL[row.f25],
            isAtRisk:   row.f25 === 'PM' || row.f25 === 'BE',
            isNominated: row.f25 === 'EE' || row.f25 === 'EX',
            belowCount: row.f25 === 'BE' ? 3 : row.f25 === 'PM' ? 1 : 0,
            releasedAt: new Date('2025-03-15'),
          },
          update: {},
        })
        created++
      }
    }

    // FY2026 result (skip LEFT / MOVED / no-data)
    if (VALID.has(row.f26)) {
      const cycleId = cyc26Map[row.bu]
      if (cycleId) {
        await prisma.result.upsert({
          where:  { cycleId_employeeId: { cycleId, employeeId } },
          create: {
            cycleId, employeeId,
            overallAvg:       CODE_TO_AVG[row.f26],
            performanceLabel: CODE_TO_LABEL[row.f26],
            isAtRisk:   row.f26 === 'PM' || row.f26 === 'BE',
            isNominated: row.f26 === 'EE' || row.f26 === 'EX',
            belowCount: row.f26 === 'BE' ? 3 : row.f26 === 'PM' ? 1 : 0,
            releasedAt: new Date('2026-03-15'),
          },
          update: {},
        })
        created++
      }
    }
  }

  console.log(`   Results created: ${created} | Skipped: ${skipped}`)

  console.log('\n✅ Import complete!')
  console.log(`   ${Object.keys(empMap).length} employees`)
  console.log('   8 review cycles (4 BU × 2 years), all closed as DONE')
  console.log(`   ${created} performance results`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
