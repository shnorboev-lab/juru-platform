import PDFDocument from 'pdfkit'
import { prisma, PerformanceLabel } from '@juru/db'
import fs from 'node:fs'
import path from 'node:path'

const REPORTS_DIR = path.join(process.cwd(), 'reports')
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true })

const LABEL_COLORS: Record<PerformanceLabel, string> = {
  EXCEPTIONAL:          '#16a34a',
  EXCEEDS_EXPECTATIONS: '#2563eb',
  MEETS_EXPECTATIONS:   '#ca8a04',
  PARTIALLY_MEETS:      '#ea580c',
  BELOW_EXPECTATIONS:   '#dc2626',
}

export async function generateReport(reportId: string, cycleId: string) {
  const cycle = await prisma.reviewCycle.findUniqueOrThrow({
    where: { id: cycleId },
    include: { bu: true },
  })
  const results = await prisma.result.findMany({
    where: { cycleId },
    include: {
      employee:   { include: { team: true } },
      subResults: true,
    },
    orderBy: { overallAvg: 'desc' },
  })

  const doc      = new PDFDocument({ margin: 50, size: 'A4' })
  const filePath = path.join(REPORTS_DIR, `${reportId}.pdf`)
  const stream   = fs.createWriteStream(filePath)
  doc.pipe(stream)

  // ── Header ────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 80).fill('#C30017')
  doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold')
     .text('JURU PERFORMANCE REVIEW', 50, 24)
  doc.fontSize(11).font('Helvetica')
     .text(cycle.label, 50, 52)

  doc.moveDown(4)

  // ── Summary stats ─────────────────────────────────────────────────────
  const dist: Record<string, number> = {}
  let atRisk = 0, nominated = 0
  for (const r of results) {
    dist[r.performanceLabel] = (dist[r.performanceLabel] ?? 0) + 1
    if (r.isAtRisk)    atRisk++
    if (r.isNominated) nominated++
  }
  const avg = results.reduce((s, r) => s + Number(r.overallAvg), 0) / (results.length || 1)

  doc.fillColor('#1a1a1a').fontSize(14).font('Helvetica-Bold').text('Summary', { underline: true })
  doc.moveDown(0.5)
  doc.fontSize(11).font('Helvetica')
  doc.text(`Total employees reviewed: ${results.length}`)
  doc.text(`Average score: ${avg.toFixed(2)}`)
  doc.text(`At-risk: ${atRisk}  |  Nominations: ${nominated}`)
  doc.moveDown()

  // ── Distribution ──────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').text('Distribution', { underline: true })
  doc.moveDown(0.5)
  const labels = Object.values(PerformanceLabel)
  for (const label of labels) {
    const count = dist[label] ?? 0
    const pct   = results.length ? ((count / results.length) * 100).toFixed(1) : '0.0'
    doc.fontSize(10).font('Helvetica')
       .text(`${label.replace(/_/g, ' ')}: ${count} (${pct}%)`)
  }
  doc.moveDown()

  // ── Individual results ────────────────────────────────────────────────
  doc.addPage()
  doc.fillColor('#1a1a1a').fontSize(14).font('Helvetica-Bold').text('Individual Results', { underline: true })
  doc.moveDown(0.5)

  for (const r of results) {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1a1a1a')
       .text(`${r.employee.fullName}  (${r.employee.grade})`)
    doc.fontSize(10).font('Helvetica').fillColor('#444')
       .text(`Team: ${r.employee.team?.name ?? '—'}   Score: ${Number(r.overallAvg).toFixed(2)}   ${r.performanceLabel.replace(/_/g,' ')}${r.isAtRisk ? '   ⚠ AT-RISK' : ''}${r.isNominated ? '   ★ NOMINATED' : ''}`)
    doc.moveDown(0.3)
    doc.fillColor('#888').fontSize(9)
    for (const sr of r.subResults) {
      doc.text(`  ${sr.subCriterion.replace(/_/g,' ')}:  E1=${Number(sr.scoreE1).toFixed(1)}  E2=${Number(sr.scoreE2).toFixed(1)}  Weighted=${Number(sr.weightedScore).toFixed(2)}`, { indent: 10 })
    }
    doc.moveDown(0.8)
    if (doc.y > 720) doc.addPage()
  }

  doc.end()

  await new Promise<void>((res, rej) => {
    stream.on('finish', res)
    stream.on('error', rej)
  })

  await prisma.report.update({
    where: { id: reportId },
    data:  { fileKey: `${reportId}.pdf`, fileUrl: `/api/v1/reports/download/${reportId}` },
  })

  console.log(`[Reports] Generated ${filePath}`)
}
