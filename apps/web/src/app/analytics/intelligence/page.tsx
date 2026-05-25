'use client'
import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Label mapping ──────────────────────────────────────────────────────────────

const TO_CODE: Record<string, string> = {
  BELOW_EXPECTATIONS: 'BE',
  PARTIALLY_MEETS:    'PM',
  MEETS_EXPECTATIONS: 'ME',
  EXCEEDS_EXPECTATIONS: 'EE',
  EXCEPTIONAL: 'EX',
}

const KEYS = ['BE', 'PM', 'ME', 'EE', 'EX'] as const
type Code = (typeof KEYS)[number]

const LONG: Record<string, string> = {
  BE: 'Below Expectations', PM: 'Partially Meets', ME: 'Meets Expectations',
  EE: 'Exceeds Expectations', EX: 'Exceptional',
}
const SHORT: Record<string, string> = {
  BE: 'Below Exp.', PM: 'Part. Meets', ME: 'Meets Exp.', EE: 'Exceeds Exp.', EX: 'Exceptional',
}
const PILL: Record<string, string> = {
  BE: 'bg-red-100 text-red-700',     PM: 'bg-amber-100 text-amber-800',
  ME: 'bg-blue-100 text-blue-700',   EE: 'bg-green-100 text-green-700',
  EX: 'bg-purple-100 text-purple-700',
}
const DOT_CLR: Record<string, string> = {
  BE: '#dc2626', PM: '#d97706', ME: '#2563eb', EE: '#16a34a', EX: '#7c3aed',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type EmpRow = {
  employeeId: string; fullName: string; bu: string
  team: string | null; grade: string
  label1: string | null   // previous cycle full label or null
  label2: string          // current cycle full label
}
type Cycle = { id: string; label: string }

// ── Helpers ────────────────────────────────────────────────────────────────────

const code = (lbl: string | null): string => (lbl ? (TO_CODE[lbl] ?? '-') : '-')
const isCode = (c: string): c is Code => (KEYS as readonly string[]).includes(c)

function countBy(rows: EmpRow[], f: 'label1' | 'label2') {
  const r: Record<string, number> = { BE: 0, PM: 0, ME: 0, EE: 0, EX: 0 }
  rows.forEach(e => { const c = code(e[f]); if (r[c] !== undefined) r[c]++ })
  return r
}

function pctArr(rows: EmpRow[], f: 'label1' | 'label2'): number[] {
  const valid = rows.filter(e => isCode(code(e[f])))
  const c = countBy(valid, f); const t = valid.length || 1
  return KEYS.map(k => +((c[k] / t) * 100).toFixed(1))
}

function pp(v: number, t: number) { return +((v / (t || 1)) * 100).toFixed(1) + '%' }

function mvDir(c1: string | null, c2: string) {
  const i = KEYS.indexOf(code(c1) as Code)
  const j = KEYS.indexOf(code(c2) as Code)
  if (i < 0 || j < 0) return 'new'
  if (j > i) return 'up'
  if (j < i) return 'dn'
  return 'eq'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CodePill({ lbl }: { lbl: string | null }) {
  const c = code(lbl)
  if (c === '-') return <span className="text-xs text-gray-300">—</span>
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PILL[c] ?? 'bg-gray-100 text-gray-500'}`}>{LONG[c]}</span>
}

function MvBadge({ c1, c2 }: { c1: string | null; c2: string }) {
  const d = mvDir(c1, c2)
  if (d === 'new') return <span className="text-xs text-gray-400">New</span>
  if (d === 'up')  return <span className="text-xs text-green-600 font-medium">▲ Improved</span>
  if (d === 'dn')  return <span className="text-xs text-red-500 font-medium">▼ Declined</span>
  return <span className="text-xs text-gray-400">→ Stable</span>
}

function LegendDot({ c, label, pct }: { c: string; label: string; pct: number }) {
  if (pct === 0) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: DOT_CLR[c] }} />
      {label}: <strong>{pct}%</strong>
    </div>
  )
}

function CurveChart({
  pcts1, name1, pcts2, name2, maxY = 75,
}: {
  pcts1?: number[]; name1?: string
  pcts2?: number[]; name2?: string
  maxY?: number
}) {
  const data = KEYS.map((k, i) => {
    const row: Record<string, number | string> = { level: SHORT[k] }
    if (pcts1 && name1) row[name1] = pcts1[i]
    if (pcts2 && name2) row[name2] = pcts2[i]
    return row
  })
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="level" tick={{ fontSize: 9, fill: '#9ca3af' }} />
        <YAxis tickFormatter={v => v + '%'} tick={{ fontSize: 9, fill: '#9ca3af' }} domain={[0, maxY]} />
        <Tooltip formatter={(v: number) => v.toFixed(1) + '%'} />
        {name1 && pcts1 && (
          <Line type="monotone" dataKey={name1} stroke="#3b82f6" strokeWidth={2.5}
            dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
        )}
        {name2 && pcts2 && (
          <Line type="monotone" dataKey={name2} stroke="#c0392b" strokeWidth={2.5}
            dot={{ r: 4, fill: '#c0392b', stroke: '#fff', strokeWidth: 2 }} />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Auto-generated BU interpretation ─────────────────────────────────────────

function buInterp(name: string, rows: EmpRow[], c1Label: string, c2Label: string): string {
  const t = rows.length
  const c1 = countBy(rows, 'label1'), c2 = countBy(rows, 'label2')
  const imp = rows.filter(e => mvDir(e.label1, e.label2) === 'up')
  const dec = rows.filter(e => mvDir(e.label1, e.label2) === 'dn')
  const stuck = rows.filter(e => code(e.label1) === 'PM' && code(e.label2) === 'PM')

  const ee1 = c1.EE + c1.EX, ee2 = c2.EE + c2.EX
  const eeChg = ee2 > ee1 ? 'grew' : ee2 < ee1 ? 'fell' : 'remained stable'
  const pmChg = c2.PM < c1.PM ? 'decreased' : c2.PM > c1.PM ? 'increased' : 'remained stable'

  return [
    `${name} has <strong>${t} employees</strong> evaluated in ${c2Label}. `,
    `The <strong>Exceeds/Exceptional</strong> cohort ${eeChg} from <strong>${pp(ee1, t)}</strong> (${c1Label}) to <strong>${pp(ee2, t)}</strong> (${c2Label}). `,
    `The <strong>Partially Meets</strong> band ${pmChg} from <strong>${pp(c1.PM, t)}</strong> to <strong>${pp(c2.PM, t)}</strong>. `,
    imp.length ? `<strong class="text-green-700">${imp.length} employee${imp.length > 1 ? 's improved' : ' improved'}</strong> their level. ` : '',
    dec.length ? `<strong class="text-red-600">${dec.length} employee${dec.length > 1 ? 's declined' : ' declined'}</strong> from the prior cycle. ` : '',
    stuck.length ? `<strong class="text-amber-700">${stuck.length} employee${stuck.length > 1 ? 's remain' : ' remains'} stuck at Partially Meets</strong> across both cycles — these require active development plans. ` : '',
    `<strong>Meets Expectations</strong> stands at <strong>${pp(c2.ME, t)}</strong> forming ${c2.ME > t / 2 ? 'a strong majority' : 'a core group'} of reliable performers.`,
  ].join('')
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4" style={{ borderTop: `3px solid ${color ?? '#e5e7eb'}` }}>
      <p className="text-xs uppercase tracking-wider text-gray-400 font-medium mb-2">{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? '#111' }}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'distribution' | 'bu' | 'period' | 'employees' | 'atrisk' | 'nominations' | 'heatmap'

// ── Sub-criterion labels ───────────────────────────────────────────────────────

const SC_LABELS: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality', CLIENT_SATISFACTION: 'Client Sat.',
  TEAMWORK: 'Teamwork', COMMERCIAL_SUCCESS: 'Commercial', TECHNICAL_SKILLS: 'Technical',
  PEOPLE_SKILLS: 'People', CONTINUOUS_LEARNING: 'Learning', DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

function heatColor(val: number) {
  if (val >= 4) return '#dcfce7'
  if (val >= 3) return '#fef9c3'
  if (val >= 2) return '#fed7aa'
  if (val > 0)  return '#fee2e2'
  return '#f9fafb'
}

type ResultRow = {
  employee: { fullName: string; grade: string; team?: { name: string } }
  overallAvg: number; belowCount: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean
  subResults: { subCriterion: string; weightedScore: number }[]
}

function PerfBadge({ label }: { label: string }) {
  const map: Record<string, string> = {
    EXCEPTIONAL:           'bg-purple-100 text-purple-700',
    EXCEEDS_EXPECTATIONS:  'bg-green-100 text-green-700',
    MEETS_EXPECTATIONS:    'bg-blue-100 text-blue-700',
    PARTIALLY_MEETS:       'bg-amber-100 text-amber-800',
    BELOW_EXPECTATIONS:    'bg-red-100 text-red-700',
  }
  const display = label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[label] ?? 'bg-gray-100 text-gray-500'}`}>{display}</span>
}

export default function PerformanceIntelligence() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycle1Id, setCycle1Id] = useState('')
  const [cycle2Id, setCycle2Id] = useState('')
  const [tab, setTab] = useState<Tab>('overview')
  const [buSel, setBuSel] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [empBuFilter, setEmpBuFilter] = useState('')
  const [empLvlFilter, setEmpLvlFilter] = useState('')
  const [buSearch, setBuSearch] = useState('')

  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then(r => r.data),
    enabled: !!me,
  })

  // Pre-select: cycle2 = most recent, cycle1 = second most recent
  useEffect(() => {
    if (cycles?.length && !cycle2Id) {
      setCycle2Id(cycles[0].id)
      if (cycles.length > 1) setCycle1Id(cycles[1].id)
    }
  }, [cycles])

  const { data: rows = [] } = useQuery<EmpRow[]>({
    queryKey: ['intelligence', cycle1Id, cycle2Id],
    queryFn: () => api.get(`/results/analytics/intelligence?cycle2Id=${cycle2Id}${cycle1Id ? `&cycle1Id=${cycle1Id}` : ''}`).then(r => r.data),
    enabled: !!cycle2Id,
  })

  // Full results for at-risk, nominations, heatmap
  const { data: fullResults = [] } = useQuery<ResultRow[]>({
    queryKey: ['results-full', cycle2Id],
    queryFn: () => api.get(`/results?cycleId=${cycle2Id}`).then(r => r.data),
    enabled: !!cycle2Id,
  })

  const atRisk   = fullResults.filter(r => r.isAtRisk)
  const nominees = fullResults.filter(r => r.isNominated)
  const teams    = [...new Set(fullResults.map(r => r.employee.team?.name ?? 'Unknown'))].sort()
  const criteria = Object.keys(SC_LABELS)

  function avgByCriteria(teamName: string, sc: string): number {
    const tr = fullResults.filter(r => (r.employee.team?.name ?? 'Unknown') === teamName)
    if (!tr.length) return 0
    const vals = tr.flatMap(r => r.subResults.filter(s => s.subCriterion === sc).map(s => Number(s.weightedScore)))
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }

  const c1Name = cycles?.find(c => c.id === cycle1Id)?.label ?? 'Previous'
  const c2Name = cycles?.find(c => c.id === cycle2Id)?.label ?? 'Current'

  // Core computed values
  const allC2  = countBy(rows, 'label2')
  const allC1  = countBy(rows, 'label1')
  const t      = rows.length
  const pcts1  = pctArr(rows, 'label1')
  const pcts2  = pctArr(rows, 'label2')
  const improved = rows.filter(e => mvDir(e.label1, e.label2) === 'up')
  const declined = rows.filter(e => mvDir(e.label1, e.label2) === 'dn')
  const stable   = rows.filter(e => mvDir(e.label1, e.label2) === 'eq')
  const stuckPM  = rows.filter(e => code(e.label1) === 'PM' && code(e.label2) === 'PM')

  const BUS = useMemo(() => [...new Set(rows.map(r => r.bu))].sort(), [rows])
  useEffect(() => { if (BUS.length && !buSel) setBuSel(BUS[0]) }, [BUS])

  const buRows     = rows.filter(r => r.bu === buSel)
  const buPcts1    = pctArr(buRows, 'label1')
  const buPcts2    = pctArr(buRows, 'label2')
  const buC1       = countBy(buRows, 'label1')
  const buC2       = countBy(buRows, 'label2')

  if (!me) return null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview',     label: 'Overview' },
    { key: 'distribution', label: 'Distribution' },
    { key: 'bu',           label: 'By BU' },
    { key: 'period',       label: 'Period Comparison' },
    { key: 'employees',    label: 'All Employees' },
    { key: 'atrisk',       label: `At-Risk (${atRisk.length})` },
    { key: 'nominations',  label: `Nominations (${nominees.length})` },
    { key: 'heatmap',      label: 'Team Heatmap' },
  ]

  // ── Employees table data ────────────────────────────────────────────────────
  const filteredEmps = rows.filter(r =>
    r.fullName.toLowerCase().includes(empSearch.toLowerCase()) &&
    (!empBuFilter || r.bu === empBuFilter) &&
    (!empLvlFilter || code(r.label2) === empLvlFilter)
  )

  // ── BU staff table (grouped by level) ──────────────────────────────────────
  const LEVEL_ORDER = ['EX', 'EE', 'ME', 'PM', 'BE'] as const
  const buFiltered = buRows.filter(r => r.fullName.toLowerCase().includes(buSearch.toLowerCase()))
  const byLevel = LEVEL_ORDER.reduce<Record<string, EmpRow[]>>((acc, k) => {
    acc[k] = buFiltered.filter(r => code(r.label2) === k)
    return acc
  }, {} as Record<string, EmpRow[]>)

  // ── Multi-BU overlay data ───────────────────────────────────────────────────
  const BU_COLORS_C1 = ['#3b82f6', '#8b5cf6', '#f59e0b', '#6b7280']
  const BU_COLORS_C2 = ['#c0392b', '#059669', '#0891b2', '#374151']
  const multiData = KEYS.map((k, i) => {
    const row: Record<string, number | string> = { level: SHORT[k] }
    BUS.forEach((b, bi) => {
      const br = rows.filter(r => r.bu === b)
      const p1 = pctArr(br, 'label1'); const p2 = pctArr(br, 'label2')
      row[`${b} (${c1Name})`] = p1[i]
      row[`${b} (${c2Name})`] = p2[i]
    })
    return row
  })

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Intelligence</h1>
            <p className="text-sm text-gray-500 mt-1">
              Multi-cycle analysis · {t} employees evaluated · {c2Name}
            </p>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Baseline:</span>
              <select value={cycle1Id} onChange={e => setCycle1Id(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                <option value="">— none —</option>
                {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Current:</span>
              <select value={cycle2Id} onChange={e => setCycle2Id(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-[#C30017] text-[#C30017]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ════════════ OVERVIEW ════════════ */}
        {tab === 'overview' && (
          <div className="space-y-5">
            {/* Stat cards */}
            <div className="grid grid-cols-5 gap-3">
              <StatCard label="Employees" value={String(t)} sub={`evaluated in ${c2Name}`} color="#6b7280" />
              <StatCard label="Exceeds / Exceptional" value={pp(allC2.EE + allC2.EX, t)}
                sub={cycle1Id ? `was ${pp(allC1.EE + allC1.EX, t)} in ${c1Name}` : undefined} color="#16a34a" />
              <StatCard label="Meets Expectations" value={pp(allC2.ME, t)}
                sub={cycle1Id ? `was ${pp(allC1.ME, t)} in ${c1Name}` : undefined} color="#2563eb" />
              <StatCard label="Partially Meets" value={pp(allC2.PM, t)}
                sub={cycle1Id ? `was ${pp(allC1.PM, t)} in ${c1Name}` : undefined} color="#d97706" />
              <StatCard label="Below Expectations" value={pp(allC2.BE, t)}
                sub={cycle1Id ? `was ${pp(allC1.BE, t)} in ${c1Name}` : undefined} color="#dc2626" />
            </div>

            {/* Insight boxes */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white border border-l-4 border-gray-200 rounded-lg p-4" style={{ borderLeftColor: '#16a34a' }}>
                <p className="text-xs font-semibold text-gray-600 mb-1">📈 Positive Movement</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {improved.length} of {t} employees ({Math.round(improved.length / (t || 1) * 100)}%) improved their level.
                  {BUS.length > 1 && (() => {
                    const bestBU = BUS.reduce((best, b) => {
                      const br = rows.filter(r => r.bu === b)
                      const impPct = br.filter(r => mvDir(r.label1, r.label2) === 'up').length / (br.length || 1)
                      const bestBr = rows.filter(r => r.bu === best)
                      const bestPct = bestBr.filter(r => mvDir(r.label1, r.label2) === 'up').length / (bestBr.length || 1)
                      return impPct > bestPct ? b : best
                    }, BUS[0])
                    return ` ${bestBU} showed the strongest improvement trajectory.`
                  })()}
                </p>
              </div>
              <div className="bg-white border border-l-4 border-gray-200 rounded-lg p-4" style={{ borderLeftColor: '#d97706' }}>
                <p className="text-xs font-semibold text-gray-600 mb-1">⚠️ Monitor Closely</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {stuckPM.length} employees remain at Partially Meets across both cycles.
                  {(() => {
                    const worstBU = BUS.reduce((worst, b) => {
                      const br = rows.filter(r => r.bu === b)
                      const pmPct = countBy(br, 'label2').PM / (br.length || 1)
                      const worstBr = rows.filter(r => r.bu === worst)
                      const worstPct = countBy(worstBr, 'label2').PM / (worstBr.length || 1)
                      return pmPct > worstPct ? b : worst
                    }, BUS[0])
                    const worstBr = rows.filter(r => r.bu === worstBU)
                    return ` ${worstBU} has the highest concentration at ${pp(countBy(worstBr, 'label2').PM, worstBr.length)}.`
                  })()}
                </p>
              </div>
              <div className="bg-white border border-l-4 border-gray-200 rounded-lg p-4" style={{ borderLeftColor: '#6b7280' }}>
                <p className="text-xs font-semibold text-gray-600 mb-1">🏢 BU Highlights</p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {BUS.map(b => {
                    const br = rows.filter(r => r.bu === b)
                    const c2 = countBy(br, 'label2')
                    return `${b}: ${pp(c2.EE + c2.EX, br.length)} EE+`
                  }).join(' · ')}
                </p>
              </div>
            </div>

            {/* Distribution charts */}
            <div className="grid grid-cols-2 gap-4">
              {cycle1Id && (
                <Card>
                  <div className="p-5">
                    <p className="text-sm font-semibold text-gray-800">Distribution — {c1Name}</p>
                    <p className="text-xs text-gray-400 mb-3">{t} employees · % per performance level</p>
                    <CurveChart pcts1={pcts1} name1={c1Name} />
                    <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                      {KEYS.map((k, i) => <LegendDot key={k} c={k} label={LONG[k]} pct={pcts1[i]} />)}
                    </div>
                  </div>
                </Card>
              )}
              <Card>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-800">Distribution — {c2Name}</p>
                  <p className="text-xs text-gray-400 mb-3">{t} employees · % per performance level</p>
                  <CurveChart pcts2={pcts2} name2={c2Name} />
                  <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                    {KEYS.map((k, i) => <LegendDot key={k} c={k} label={LONG[k]} pct={pcts2[i]} />)}
                  </div>
                </div>
              </Card>
            </div>

            {/* Written interpretation */}
            {cycle1Id && (
              <Card>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-800 mb-1">Company-Wide Performance Analysis</p>
                  <p className="text-xs text-gray-400 mb-4">{c1Name} vs {c2Name} · {t} employees across all business units</p>
                  <div className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html:
                    `Across the <strong>${t} employees</strong> evaluated in both cycles, the overall performance profile in <strong>${c2Name}</strong> shows ` +
                    (() => {
                      const pmDiff = allC2.PM - allC1.PM
                      const eeDiff = (allC2.EE + allC2.EX) - (allC1.EE + allC1.EX)
                      const pmTrend = pmDiff < 0 ? `<strong class="text-green-700">a positive shift</strong> — the Partially Meets band decreased from <strong>${pp(allC1.PM, t)}</strong> to <strong class="text-green-700">${pp(allC2.PM, t)}</strong>` :
                        pmDiff > 0 ? `<strong class="text-amber-700">an upward shift in at-risk employees</strong> — Partially Meets grew from <strong>${pp(allC1.PM, t)}</strong> to <strong class="text-amber-700">${pp(allC2.PM, t)}</strong>` :
                        'a <strong>stable Partially Meets</strong> band'
                      const eeTrend = eeDiff > 0 ? `The Exceeds/Exceptional cohort <strong class="text-green-700">grew</strong> from <strong>${pp(allC1.EE + allC1.EX, t)}</strong> to <strong class="text-green-700">${pp(allC2.EE + allC2.EX, t)}</strong>` :
                        eeDiff < 0 ? `The Exceeds/Exceptional cohort <strong class="text-amber-700">declined</strong> from <strong>${pp(allC1.EE + allC1.EX, t)}</strong> to <strong class="text-amber-700">${pp(allC2.EE + allC2.EX, t)}</strong>` :
                        `The Exceeds/Exceptional cohort <strong>remained stable</strong> at <strong>${pp(allC2.EE + allC2.EX, t)}</strong>`
                      return `${pmTrend}.<br/><br/>${eeTrend}. <strong>${improved.length} employees (${Math.round(improved.length / t * 100)}%)</strong> improved their performance level between cycles, while <strong class="text-red-600">${declined.length} declined</strong> and <strong>${stable.length}</strong> remained at the same level. ` +
                        (stuckPM.length ? `The <strong class="text-amber-700">${stuckPM.length} employees who remain at Partially Meets across both cycles</strong> represent the most critical cohort requiring active intervention.` : '')
                    })()
                  }} />
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════ DISTRIBUTION ════════════ */}
        {tab === 'distribution' && (
          <div className="space-y-5">
            {cycle1Id && (
              <Card>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-800">Company-Wide Distribution Overlay</p>
                  <p className="text-xs text-gray-400 mb-4">{c1Name} vs {c2Name} · % of {t} employees per level</p>
                  <CurveChart pcts1={pcts1} name1={c1Name} pcts2={pcts2} name2={c2Name} />
                  <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#3b82f6]" />{c1Name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#c0392b]" />{c2Name}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Per-BU charts */}
            {['label1', 'label2'].map(field => {
              const isC1 = field === 'label1'
              if (isC1 && !cycle1Id) return null
              return (
                <div key={field}>
                  <p className="text-xs font-semibold uppercase tracking-widest text-[#C30017] mb-3">
                    BY BUSINESS UNIT — {isC1 ? c1Name : c2Name}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {BUS.map(b => {
                      const br = rows.filter(r => r.bu === b)
                      const p = pctArr(br, field as 'label1' | 'label2')
                      const clr = isC1 ? '#3b82f6' : '#c0392b'
                      return (
                        <Card key={b}>
                          <div className="p-5">
                            <p className="text-sm font-semibold text-gray-800">{b} <span className="text-xs font-normal text-gray-400">({br.length} employees)</span></p>
                            <p className="text-xs text-gray-400 mb-3">{isC1 ? c1Name : c2Name} · distribution curve</p>
                            <CurveChart {...(isC1 ? { pcts1: p, name1: isC1 ? c1Name : c2Name } : { pcts2: p, name2: c2Name })} />
                            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                              {KEYS.map((k, i) => <LegendDot key={k} c={k} label={LONG[k]} pct={p[i]} />)}
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ════════════ BY BU ════════════ */}
        {tab === 'bu' && (
          <div className="space-y-5">
            {/* BU selector */}
            <div className="flex gap-2 flex-wrap">
              {BUS.map(b => {
                const br = rows.filter(r => r.bu === b)
                return (
                  <button key={b} onClick={() => { setBuSel(b); setBuSearch('') }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                      buSel === b
                        ? 'bg-[#C30017] border-[#C30017] text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-[#C30017] hover:text-[#C30017]'
                    }`}>
                    {b} · {br.length}
                  </button>
                )
              })}
            </div>

            {/* BU strip stats */}
            <div className="grid border border-gray-200 rounded-lg overflow-hidden" style={{ gridTemplateColumns: `repeat(5, 1fr)` }}>
              {[
                { label: 'Business Unit', value: buSel, sub: '' },
                { label: 'Employees', value: String(buRows.length), sub: 'both cycles' },
                { label: `Exceeds+ ${c2Name}`, value: pp(buC2.EE + buC2.EX, buRows.length), sub: cycle1Id ? `${c1Name}: ${pp(buC1.EE + buC1.EX, buRows.length)}` : '' },
                { label: `Meets ${c2Name}`, value: pp(buC2.ME, buRows.length), sub: cycle1Id ? `${c1Name}: ${pp(buC1.ME, buRows.length)}` : '' },
                { label: `Part. Meets ${c2Name}`, value: pp(buC2.PM, buRows.length), sub: cycle1Id ? `${c1Name}: ${pp(buC1.PM, buRows.length)}` : '' },
              ].map((item, i) => (
                <div key={i} className={`p-3 bg-white ${i < 4 ? 'border-r border-gray-200' : ''}`}>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                  <p className="text-lg font-bold text-gray-900">{item.value}</p>
                  {item.sub && <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              {cycle1Id && (
                <Card>
                  <div className="p-5">
                    <p className="text-sm font-semibold text-gray-800">{buSel} — {c1Name}</p>
                    <p className="text-xs text-gray-400 mb-3">Distribution curve</p>
                    <CurveChart pcts1={buPcts1} name1={c1Name} />
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                      {KEYS.map((k, i) => <LegendDot key={k} c={k} label={LONG[k]} pct={buPcts1[i]} />)}
                    </div>
                  </div>
                </Card>
              )}
              <Card>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-800">{buSel} — {c2Name}</p>
                  <p className="text-xs text-gray-400 mb-3">Distribution curve</p>
                  <CurveChart pcts2={buPcts2} name2={c2Name} />
                  <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                    {KEYS.map((k, i) => <LegendDot key={k} c={k} label={LONG[k]} pct={buPcts2[i]} />)}
                  </div>
                </div>
              </Card>
            </div>

            {/* Overlay */}
            {cycle1Id && (
              <Card>
                <div className="p-5">
                  <p className="text-sm font-semibold text-gray-800">{buSel} — Period-over-Period Overlay</p>
                  <p className="text-xs text-gray-400 mb-4">{c1Name} vs {c2Name}</p>
                  <CurveChart pcts1={buPcts1} name1={c1Name} pcts2={buPcts2} name2={c2Name} />
                  <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#3b82f6]" />{c1Name}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#c0392b]" />{c2Name}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* BU interpretation */}
            {cycle1Id && (
              <div className="bg-gray-50 border border-l-4 border-gray-200 rounded-lg p-5" style={{ borderLeftColor: '#C30017' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#C30017] mb-3">{buSel} — Analysis</p>
                <div className="text-sm text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: buInterp(buSel, buRows, c1Name, c2Name) }} />
              </div>
            )}

            {/* Staff table grouped by level */}
            <Card>
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{buSel} — Staff Performance Results</p>
                  <p className="text-xs text-gray-400 mt-0.5">{c1Name} & {c2Name} · evaluated employees</p>
                </div>
                <input value={buSearch} onChange={e => setBuSearch(e.target.value)}
                  placeholder="Search…"
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] w-44" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                      <th className="px-6 py-2 text-left font-medium">#</th>
                      <th className="px-4 py-2 text-left font-medium">Employee</th>
                      <th className="px-4 py-2 text-left font-medium">{c1Name}</th>
                      <th className="px-4 py-2 text-left font-medium">{c2Name}</th>
                      <th className="px-4 py-2 text-left font-medium">Movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LEVEL_ORDER.map(lvl => {
                      const grp = byLevel[lvl]
                      if (!grp?.length) return null
                      return [
                        <tr key={`hdr-${lvl}`}>
                          <td colSpan={5} className="px-6 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50"
                            style={{ borderLeft: `3px solid ${DOT_CLR[lvl]}` }}>
                            {LONG[lvl]} ({grp.length})
                          </td>
                        </tr>,
                        ...grp.sort((a, b) => a.fullName.localeCompare(b.fullName)).map((e, i) => (
                          <tr key={e.employeeId} className="border-b border-gray-50 hover:bg-gray-50/60">
                            <td className="px-6 py-2 text-xs text-gray-400">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-gray-900">{e.fullName}</td>
                            <td className="px-4 py-2"><CodePill lbl={e.label1} /></td>
                            <td className="px-4 py-2"><CodePill lbl={e.label2} /></td>
                            <td className="px-4 py-2"><MvBadge c1={e.label1} c2={e.label2} /></td>
                          </tr>
                        )),
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ════════════ PERIOD COMPARISON ════════════ */}
        {tab === 'period' && (
          <div className="space-y-5">
            {cycle1Id ? (
              <>
                <Card>
                  <div className="p-5">
                    <p className="text-sm font-semibold text-gray-800">Company-Wide Distribution Overlay</p>
                    <p className="text-xs text-gray-400 mb-4">{c1Name} vs {c2Name} · {t} employees</p>
                    <CurveChart pcts1={pcts1} name1={c1Name} pcts2={pcts2} name2={c2Name} maxY={80} />
                    <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#3b82f6]" />{c1Name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><div className="w-3 h-1.5 rounded bg-[#c0392b]" />{c2Name}</div>
                    </div>
                  </div>
                </Card>

                {/* Movement analysis */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    {
                      label: '▲ Improved', sub: 'Moved up at least one level', n: improved.length,
                      color: '#16a34a', textColor: 'text-green-600',
                      examples: improved.slice(0, 6).map(e => `${e.fullName} · ${e.bu} · ${code(e.label1)}→${code(e.label2)}`),
                    },
                    {
                      label: '→ Stable', sub: 'Same performance level', n: stable.length,
                      color: '#9ca3af', textColor: 'text-gray-500',
                      examples: [],
                    },
                    {
                      label: '▼ Declined', sub: 'Moved down at least one level', n: declined.length,
                      color: '#dc2626', textColor: 'text-red-600',
                      examples: declined.slice(0, 6).map(e => `${e.fullName} · ${e.bu} · ${code(e.label1)}→${code(e.label2)}`),
                    },
                  ].map(mv => (
                    <div key={mv.label} className="bg-white border rounded-lg p-5" style={{ borderLeft: `3px solid ${mv.color}` }}>
                      <p className="text-sm font-semibold text-gray-800">{mv.label}</p>
                      <p className="text-xs text-gray-400 mb-2">{mv.sub}</p>
                      <p className={`text-4xl font-bold ${mv.textColor}`}>{mv.n}</p>
                      <p className="text-xs text-gray-400 mt-1">{Math.round(mv.n / (t || 1) * 100)}% of employees</p>
                      {mv.examples.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-xs text-gray-400 uppercase tracking-wider">Notable examples</p>
                          {mv.examples.map(ex => (
                            <p key={ex} className="text-xs text-gray-600 border-b border-gray-50 py-1">{ex}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Written interpretation */}
                <Card>
                  <div className="p-5">
                    <p className="text-sm font-semibold text-gray-800 mb-1">Period-over-Period Analysis</p>
                    <p className="text-xs text-gray-400 mb-4">What changed between {c1Name} and {c2Name}, and what it means</p>
                    <div className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html:
                      `The period-over-period comparison across <strong>${t} matched employees</strong> reveals ` +
                      (() => {
                        const pmChg = allC2.PM < allC1.PM
                        const eeChg = (allC2.EE + allC2.EX) > (allC1.EE + allC1.EX)
                        return `${pmChg ? 'a <strong class="text-green-700">generally positive directional trend</strong>' : 'a <strong class="text-amber-700">mixed picture</strong>'} across the organisation.` +
                          `<br/><br/>The <strong>Partially Meets band ${pmChg ? 'narrowed' : 'widened'}</strong> from <strong>${pp(allC1.PM, t)}</strong> to <strong>${pp(allC2.PM, t)}</strong>${pmChg ? ' — a positive signal that development plans are translating into measurable improvement' : ' — indicating the at-risk population has grown'}. ` +
                          `The <strong>Exceeds/Exceptional cohort ${eeChg ? 'grew' : 'fell'}</strong> from <strong>${pp(allC1.EE + allC1.EX, t)}</strong> to <strong>${pp(allC2.EE + allC2.EX, t)}</strong>.` +
                          `<br/><br/><strong>${improved.length} employees improved</strong> their rating — the majority through PM→ME transitions, which is the most operationally significant shift. <strong class="text-red-600">${declined.length} employees declined</strong>, and these cases demand targeted attention: understand the root cause and take corrective action before the next review.` +
                          (stuckPM.length ? `<br/><br/><strong class="text-amber-700">${stuckPM.length} employees remain at Partially Meets across both cycles</strong>. Per performance policy, these employees must have active Development Plans with clear milestones. If no progress is demonstrated by the next review, formal consideration is required.` : '')
                      })()
                    }} />
                  </div>
                </Card>

                {/* Multi-BU overlay */}
                {BUS.length > 1 && (
                  <Card>
                    <div className="p-5">
                      <p className="text-sm font-semibold text-gray-800">All BUs — Period-over-Period Overlay</p>
                      <p className="text-xs text-gray-400 mb-4">Dashed = {c1Name} · Solid = {c2Name}</p>
                      <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={multiData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                          <XAxis dataKey="level" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                          <YAxis tickFormatter={v => v + '%'} tick={{ fontSize: 9, fill: '#9ca3af' }} />
                          <Tooltip formatter={(v: number) => v.toFixed(1) + '%'} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {BUS.flatMap((b, bi) => [
                            <Line key={`${b}-c1`} type="monotone" dataKey={`${b} (${c1Name})`}
                              stroke={BU_COLORS_C1[bi % BU_COLORS_C1.length]} strokeWidth={1.5}
                              strokeDasharray="5 4" dot={{ r: 3 }} />,
                            <Line key={`${b}-c2`} type="monotone" dataKey={`${b} (${c2Name})`}
                              stroke={BU_COLORS_C2[bi % BU_COLORS_C2.length]} strokeWidth={2}
                              dot={{ r: 4 }} />,
                          ])}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}
              </>
            ) : (
              <div className="text-center py-16 text-gray-400 text-sm">
                Select a baseline cycle above to enable period comparison.
              </div>
            )}
          </div>
        )}

        {/* ════════════ EMPLOYEE ROSTER ════════════ */}
        {tab === 'employees' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <input value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                placeholder="Search by name…"
                className="flex-1 min-w-0 max-w-xs px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
              <select value={empBuFilter} onChange={e => setEmpBuFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                <option value="">All BUs</option>
                {BUS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={empLvlFilter} onChange={e => setEmpLvlFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                <option value="">All {c2Name} Levels</option>
                {KEYS.map(k => <option key={k} value={k}>{LONG[k]}</option>)}
              </select>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                      <th className="px-6 py-2 text-left font-medium">#</th>
                      <th className="px-4 py-2 text-left font-medium">Employee</th>
                      <th className="px-4 py-2 text-left font-medium">BU</th>
                      <th className="px-4 py-2 text-left font-medium">Team</th>
                      <th className="px-4 py-2 text-left font-medium">{c1Name}</th>
                      <th className="px-4 py-2 text-left font-medium">{c2Name}</th>
                      <th className="px-4 py-2 text-left font-medium">Movement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmps.map((e, i) => (
                      <tr key={e.employeeId} className="border-b border-gray-50 hover:bg-gray-50/60">
                        <td className="px-6 py-2 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{e.fullName}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{e.bu}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{e.team ?? '—'}</td>
                        <td className="px-4 py-2"><CodePill lbl={e.label1} /></td>
                        <td className="px-4 py-2"><CodePill lbl={e.label2} /></td>
                        <td className="px-4 py-2"><MvBadge c1={e.label1} c2={e.label2} /></td>
                      </tr>
                    ))}
                    {filteredEmps.length === 0 && (
                      <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-sm">No employees match the filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ════════════ AT-RISK ════════════ */}
        {tab === 'atrisk' && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">At-Risk Employees</p>
              <p className="text-xs text-gray-400 mt-0.5">{c2Name} · employees requiring Development Program review</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                    <th className="px-6 py-2 text-left font-medium">Employee</th>
                    <th className="px-4 py-2 text-center font-medium">Grade</th>
                    <th className="px-4 py-2 text-left font-medium">Team</th>
                    <th className="px-4 py-2 text-center font-medium">Score</th>
                    <th className="px-4 py-2 text-center font-medium">Below Count</th>
                    <th className="px-4 py-2 text-center font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-6 py-2.5 font-medium text-gray-900">{r.employee.fullName}</td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono bg-transparent">
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.employee.grade}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{r.employee.team?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-red-600">{Number(r.overallAvg).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-red-500 text-sm">{r.belowCount}</td>
                      <td className="px-4 py-2.5 text-center"><PerfBadge label={r.performanceLabel} /></td>
                    </tr>
                  ))}
                  {atRisk.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-gray-400 text-sm">No at-risk employees in this cycle.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ════════════ NOMINATIONS ════════════ */}
        {tab === 'nominations' && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Nominations</p>
              <p className="text-xs text-gray-400 mt-0.5">{c2Name} · employees with avg ≥ 4.0, eligible for recognition</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
                    <th className="px-6 py-2 text-left font-medium">Employee</th>
                    <th className="px-4 py-2 text-center font-medium">Grade</th>
                    <th className="px-4 py-2 text-left font-medium">Team</th>
                    <th className="px-4 py-2 text-center font-medium">Score</th>
                    <th className="px-4 py-2 text-center font-medium">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {nominees.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/60">
                      <td className="px-6 py-2.5 font-medium text-gray-900">⭐ {r.employee.fullName}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{r.employee.grade}</span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{r.employee.team?.name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center font-semibold text-green-600">{Number(r.overallAvg).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-center"><PerfBadge label={r.performanceLabel} /></td>
                    </tr>
                  ))}
                  {nominees.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400 text-sm">No nominations yet for this cycle.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ════════════ HEATMAP ════════════ */}
        {tab === 'heatmap' && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Team × Criterion Heatmap</p>
              <p className="text-xs text-gray-400 mt-0.5">{c2Name} · average weighted score per team and sub-criterion</p>
            </div>
            <div className="p-6 overflow-x-auto">
              {fullResults.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-8">No score data available for this cycle.</p>
              ) : (
                <>
                  <table className="text-xs w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="text-left px-3 py-2 text-gray-500 font-medium whitespace-nowrap bg-gray-50 border border-gray-100">Team</th>
                        {criteria.map(sc => (
                          <th key={sc} className="px-3 py-2 text-center text-gray-500 font-medium bg-gray-50 border border-gray-100 whitespace-nowrap">
                            {SC_LABELS[sc]}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center text-gray-500 font-medium bg-gray-50 border border-gray-100">Avg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map(team => {
                        const vals = criteria.map(sc => avgByCriteria(team, sc))
                        const nonZero = vals.filter(v => v > 0)
                        const teamAvg = nonZero.length ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0
                        return (
                          <tr key={team}>
                            <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap border border-gray-100 bg-gray-50">{team}</td>
                            {vals.map((val, i) => (
                              <td key={i} className="px-3 py-2 text-center border border-gray-100 font-medium"
                                style={{ background: heatColor(val) }}
                                title={`${team} · ${SC_LABELS[criteria[i]]} · ${val.toFixed(2)}`}>
                                {val > 0 ? val.toFixed(1) : '—'}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center border border-gray-100 font-bold"
                              style={{ background: heatColor(teamAvg) }}>
                              {teamAvg > 0 ? teamAvg.toFixed(1) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  <div className="flex items-center gap-6 mt-4 text-xs text-gray-500">
                    {[['#dcfce7','≥ 4.0 Exceeds'],['#fef9c3','3.0–3.9 Meets'],['#fed7aa','2.0–2.9 Partially Meets'],['#fee2e2','< 2.0 Below']].map(([bg, lbl]) => (
                      <div key={lbl} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded border border-gray-200" style={{ background: bg }} />
                        {lbl}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </Card>
        )}

        {/* No data state */}
        {rows.length === 0 && cycle2Id && (
          <div className="text-center py-16 text-gray-400 text-sm">
            No results found for the selected cycle. Results are available once scores are calculated.
          </div>
        )}

      </div>
    </Shell>
  )
}
