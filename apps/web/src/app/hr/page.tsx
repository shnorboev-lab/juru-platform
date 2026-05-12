'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import Link from 'next/link'

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = ['PREP','SELF_APPRAISAL','EVALUATION','CONSOLIDATION','INTERVIEW','DONE']
const PHASE_LABEL: Record<string, string> = {
  PREP:'Preparation', SELF_APPRAISAL:'Self-Appraisal', EVALUATION:'Evaluation',
  CONSOLIDATION:'Consolidation', INTERVIEW:'Interviews', DONE:'Done',
}
const PHASE_COLOR: Record<string, string> = {
  PREP:'bg-gray-100 text-gray-600', SELF_APPRAISAL:'bg-blue-100 text-blue-700',
  EVALUATION:'bg-purple-100 text-purple-700', CONSOLIDATION:'bg-amber-100 text-amber-700',
  INTERVIEW:'bg-orange-100 text-orange-700', DONE:'bg-green-100 text-green-700',
}
const ALL_ROLES = ['EMPLOYEE','EVALUATOR','TEAM_HEAD','BU_HEAD','MD','HR_ADMIN']
const ROLE_ACCESS: Record<string, string[]> = {
  EMPLOYEE:   ['Notification feed'],
  EVALUATOR:  ['Evaluations panel', 'Notification feed'],
  TEAM_HEAD:  ['Staff Progress', 'Analytics', 'Interview notes', 'Notifications'],
  BU_HEAD:    ['Staff Progress', 'Analytics', 'Reports', 'Notifications'],
  MD:         ['Staff Progress', 'Analytics', 'Notifications'],
  HR_ADMIN:   ['All of the above', 'Cycles', 'Employees', 'Access management'],
}
const ROLE_COLOR: Record<string, string> = {
  HR_ADMIN:'bg-purple-100 text-purple-800', EVALUATOR:'bg-amber-100 text-amber-700',
  TEAM_HEAD:'bg-green-100 text-green-700', BU_HEAD:'bg-orange-100 text-orange-700',
  MD:'bg-red-100 text-red-700', EMPLOYEE:'bg-blue-100 text-blue-700',
}

type Cycle = {
  id: string; label: string; phase: string; bu: { name: string }
  selfAppraisalEnd: string; evaluationEnd: string; resultsReleasedAt?: string
  type: string; year: number
}
type Employee = {
  id: string; juruId?: string; fullName: string; email: string
  position?: string; office?: string; grade: string
  team?: { name: string }; bu?: { name: string }; role: string; isActive: boolean
}
type CycleActivity = {
  cycle: Cycle
  totals: { assigned: number; selfDone: number; selfDraft: number; eval1Done: number; eval2Done: number }
  employees: Array<{
    employee: { id: string; fullName: string; juruId?: string; email: string; grade: string; team?: { name: string } }
    evaluator1: { fullName: string; email: string }
    evaluator2: { fullName: string; email: string }
    self?:  { status: string; updatedAt: string } | null
    eval1?: { status: string; updatedAt: string } | null
    eval2?: { status: string; updatedAt: string } | null
  }>
}

// ─── Mini components ──────────────────────────────────────────────────────────

function PhaseBar({ phase }: { phase: string }) {
  const idx = PHASES.indexOf(phase)
  return (
    <div className="flex items-center w-full gap-0">
      {PHASES.map((p, i) => (
        <div key={p} className="flex items-center flex-1 min-w-0" title={PHASE_LABEL[p]}>
          <div className={`h-1.5 flex-1 ${i < idx ? 'bg-[#C30017]' : i === idx ? 'bg-[#C30017]' : 'bg-gray-200'}`} />
          <div className={`w-2 h-2 rounded-full shrink-0 ${i <= idx ? 'bg-[#C30017]' : 'bg-gray-300'}`} />
        </div>
      ))}
    </div>
  )
}

function StatusDot({ status }: { status?: string | null }) {
  if (!status) return <span className="inline-block w-2 h-2 rounded-full bg-gray-200" title="Not started"/>
  if (status === 'SUBMITTED') return <span className="inline-block w-2 h-2 rounded-full bg-green-500" title="Submitted"/>
  return <span className="inline-block w-2 h-2 rounded-full bg-amber-400" title="Draft"/>
}

function Stat({ label, value, sub, warn }: { label: string; value: number|string; sub?: string; warn?: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-amber-600' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Inline editable cell ─────────────────────────────────────────────────────

function EditableCell({ value, onSave, type = 'text', placeholder }: {
  value: string; onSave: (v: string) => void; type?: string; placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    if (val !== value) onSave(val)
    setEditing(false)
  }

  if (!editing) return (
    <button
      onClick={() => { setVal(value); setEditing(true) }}
      className="text-left hover:text-[#C30017] hover:underline transition-colors max-w-[200px] truncate block"
      title={value || placeholder}
    >
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </button>
  )
  return (
    <input
      ref={inputRef} type={type} value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
      className="border border-[#C30017] rounded px-2 py-0.5 text-sm w-48 focus:outline-none"
    />
  )
}

// ─── Staff Progress tab (embedded) ───────────────────────────────────────────

type BUProgressRow = {
  id: string; fullName: string; juruId?: string; grade: string
  team?: { name: string }; bu?: { name: string }
  submissions: { self?: string; eval1?: string; eval2?: string }
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="text-gray-300 text-xs">—</span>
  if (status === 'SUBMITTED') return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">✓ Done</span>
  return <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">Draft</span>
}

function StaffProgressTab({ cycleId, cycles, bus }: {
  cycleId: string
  cycles: { id: string; label: string; phase: string }[]
  bus: { id: string; name: string }[]
}) {
  const [selectedCycle, setSelectedCycle] = useState(cycleId)
  const [teamFilter, setTeamFilter] = useState('')

  const { data: rows, isLoading } = useQuery<BUProgressRow[]>({
    queryKey: ['bu-progress', selectedCycle],
    queryFn: () => api.get(`/employees/bu-progress/${selectedCycle}`).then(r => r.data),
    enabled: !!selectedCycle,
  })

  const filtered = rows?.filter(r => !teamFilter || r.team?.name === teamFilter) ?? []
  const teams = [...new Set(rows?.map(r => r.team?.name).filter(Boolean) as string[])]

  const selfDone  = filtered.filter(r => r.submissions.self  === 'SUBMITTED').length
  const eval1Done = filtered.filter(r => r.submissions.eval1 === 'SUBMITTED').length
  const eval2Done = filtered.filter(r => r.submissions.eval2 === 'SUBMITTED').length
  const total     = filtered.length

  const byTeam = filtered.reduce<Record<string, BUProgressRow[]>>((acc, r) => {
    const k = r.team?.name ?? 'No Team'; (acc[k] ??= []).push(r); return acc
  }, {})

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
          {cycles.map(c => <option key={c.id} value={c.id}>{c.label} · {c.phase}</option>)}
        </select>
        <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
          <option value="">All Teams</option>
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Summary bars */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Self-Appraisals', done: selfDone },
            { label: 'Evaluations E1',  done: eval1Done },
            { label: 'Evaluations E2',  done: eval2Done },
          ].map(({ label, done }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-600 font-medium">{label}</span>
                <span className="font-bold text-gray-900">{done}/{total}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 bg-[#C30017] rounded-full transition-all" style={{ width: `${(done/total)*100}%` }}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-400 py-4">Loading…</p>}

      {/* Tables by team */}
      {Object.entries(byTeam).sort().map(([team, emps]) => (
        <Card key={team}>
          <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-800">{team}</span>
            <span className="text-xs text-gray-400">{emps.length} staff</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Juru ID</th>
                <th className="px-4 py-2 text-center">Grade</th>
                <th className="px-4 py-2 text-center">Self</th>
                <th className="px-4 py-2 text-center">E1</th>
                <th className="px-4 py-2 text-center">E2</th>
              </tr>
            </thead>
            <tbody>
              {emps.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{r.fullName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{r.juruId ?? '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.grade}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center"><StatusPill status={r.submissions.self}/></td>
                  <td className="px-4 py-2.5 text-center"><StatusPill status={r.submissions.eval1}/></td>
                  <td className="px-4 py-2.5 text-center"><StatusPill status={r.submissions.eval2}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const [me, setMe] = useState<Me | null>(null)
  const [tab, setTab] = useState<'cycles'|'employees'|'progress'|'access'>('cycles')
  const [activeCycleId, setActiveCycleId] = useState<string>('')
  const [showCreate, setShowCreate] = useState(false)
  const [empSearch, setEmpSearch] = useState('')
  const [empBU, setEmpBU] = useState('')
  const [createForm, setCreateForm] = useState({
    type:'SEMI_ANNUAL', year: new Date().getFullYear(), label:'', buId:'',
    selfAppraisalStart:'', selfAppraisalEnd:'', evaluationEnd:'', consolidationEnd:'', interviewEnd:'',
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadCycleId, setUploadCycleId] = useState<string|null>(null)
  const qc = useQueryClient()

  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  const { data: bus } = useQuery<{ id:string; name:string; teams:{id:string;name:string}[] }[]>({
    queryKey: ['business-units'], queryFn: () => api.get('/employees/meta/business-units').then(r => r.data), enabled: !!me,
  })
  const { data: emailStats } = useQuery<{ total:number; withPlaceholderEmail:number; withRealEmail:number }>({
    queryKey: ['email-stats'], queryFn: () => api.get('/employees/meta/email-stats').then(r => r.data), enabled: !!me,
  })
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees', empSearch, empBU],
    queryFn: () => api.get(`/employees?isActive=true${empSearch?`&search=${encodeURIComponent(empSearch)}`:''}${empBU?`&buId=${empBU}`:''}`).then(r => r.data),
    enabled: !!me && tab === 'employees',
  })
  const { data: activity } = useQuery<CycleActivity>({
    queryKey: ['cycle-activity', activeCycleId],
    queryFn: () => api.get(`/cycles/${activeCycleId}/activity`).then(r => r.data),
    enabled: !!activeCycleId && tab === 'cycles',
    refetchInterval: 30_000,
  })

  useEffect(() => { if (cycles?.length && !activeCycleId) setActiveCycleId(cycles[0].id) }, [cycles])

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => api.post('/cycles', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); setShowCreate(false) },
  })
  const phaseMutation = useMutation({
    mutationFn: ({ id, phase }: { id:string; phase:string }) => api.patch(`/cycles/${id}/phase`, { phase }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); qc.invalidateQueries({ queryKey: ['cycle-activity', activeCycleId] }) },
  })
  const releaseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/cycles/${id}/release`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles'] }),
  })
  const updateEmpMutation = useMutation({
    mutationFn: ({ id, data }: { id:string; data: Partial<Employee> }) => api.patch(`/employees/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  async function handleMatrixUpload(cycleId: string, file: File) {
    const form = new FormData(); form.append('file', file)
    await api.post(`/assignments/upload?cycleId=${cycleId}`, form, { headers:{ 'Content-Type':'multipart/form-data' } })
    qc.invalidateQueries({ queryKey: ['cycle-activity', cycleId] })
  }

  if (!me) return null

  const activeCycle = cycles?.find(c => c.id === activeCycleId)

  // Employees grouped by BU for the employees tab
  const byBU = employees?.reduce<Record<string, Employee[]>>((acc, e) => {
    const k = e.bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(e); return acc
  }, {}) ?? {}

  // Is email a placeholder (auto-generated from juruId)?
  function isPlaceholder(email: string) {
    return /^[a-z]{2}\d{2}\d{3,4}@/.test(email)
  }

  const TABS = [
    { key: 'cycles',    label: 'Cycles & Activity' },
    { key: 'employees', label: `Employees${emailStats?.withPlaceholderEmail ? ` ⚠ ${emailStats.withPlaceholderEmail}` : ''}` },
    { key: 'progress',  label: 'Staff Progress' },
    { key: 'access',    label: 'Access Matrix' },
  ] as const

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500 mt-1">Manage cycles, employees, access and monitor all activity</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Stat label="Total employees" value={emailStats?.total ?? '…'} />
          <Stat label="Active cycles" value={cycles?.filter(c=>c.phase!=='DONE').length ?? '…'} />
          <Stat
            label="Missing real emails" value={emailStats?.withPlaceholderEmail ?? '…'}
            sub="Auto-generated from Juru ID" warn={!!emailStats?.withPlaceholderEmail}
          />
          <Stat label="Business Units" value={bus?.length ?? '…'} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab===t.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CYCLES TAB ───────────────────────────────────────────────────── */}
        {tab === 'cycles' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              {/* Cycle selector */}
              <div className="flex gap-2 flex-wrap">
                {cycles?.map(c => (
                  <button key={c.id} onClick={() => setActiveCycleId(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${activeCycleId===c.id ? 'bg-[#C30017] text-white border-[#C30017]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>+ New Cycle</Button>
            </div>

            {/* Create form */}
            {showCreate && (
              <Card>
                <div className="p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Create New Cycle</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                      <select value={createForm.type} onChange={e=>setCreateForm(f=>({...f,type:e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                        <option value="SEMI_ANNUAL">Semi-Annual</option>
                        <option value="ANNUAL">Annual</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Year</label>
                      <input type="number" value={createForm.year} onChange={e=>setCreateForm(f=>({...f,year:+e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"/>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Label</label>
                      <input placeholder="Semi-Annual 2026 — SBU" value={createForm.label} onChange={e=>setCreateForm(f=>({...f,label:e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"/>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">Business Unit</label>
                      <select value={createForm.buId} onChange={e=>setCreateForm(f=>({...f,buId:e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                        <option value="">Select BU…</option>
                        {bus?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    {(['selfAppraisalStart','selfAppraisalEnd','evaluationEnd','consolidationEnd','interviewEnd'] as const).map(k => (
                      <div key={k}>
                        <label className="text-xs font-medium text-gray-600 block mb-1">
                          {k.replace(/([A-Z])/g,' $1').replace('self Appraisal','Self-Appraisal').replace('evaluation End','Evaluation End').replace('consolidation End','Consolidation End').replace('interview End','Interview End').trim()}
                        </label>
                        <input type="date" value={(createForm as Record<string,unknown>)[k] as string}
                          onChange={e=>setCreateForm(f=>({...f,[k]:e.target.value}))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"/>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Button onClick={() => createMutation.mutate(createForm)}>Create Cycle</Button>
                    <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </div>
              </Card>
            )}

            {/* Active cycle detail */}
            {activeCycle && (
              <div className="grid grid-cols-3 gap-4">
                {/* Left: cycle info + controls */}
                <div className="space-y-4">
                  <Card>
                    <div className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{activeCycle.label}</h3>
                          <p className="text-xs text-gray-500 mt-0.5">{activeCycle.bu?.name}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${PHASE_COLOR[activeCycle.phase]}`}>
                          {PHASE_LABEL[activeCycle.phase]}
                        </span>
                      </div>
                      <PhaseBar phase={activeCycle.phase} />
                      <div className="text-xs text-gray-500 space-y-1">
                        {PHASES.map((p, i) => (
                          <div key={p} className={`flex items-center gap-2 ${p === activeCycle.phase ? 'font-semibold text-[#C30017]' : ''}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${PHASES.indexOf(activeCycle.phase) >= i ? 'bg-[#C30017]' : 'bg-gray-300'}`}/>
                            {PHASE_LABEL[p]}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Controls */}
                  <Card>
                    <div className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
                      {activeCycle.phase !== 'DONE' && (
                        <Button size="sm" className="w-full" variant="secondary"
                          onClick={() => {
                            const next = PHASES[PHASES.indexOf(activeCycle.phase)+1]
                            if (next && confirm(`Advance to ${PHASE_LABEL[next]}?`)) phaseMutation.mutate({ id: activeCycle.id, phase: next })
                          }}>
                          → Advance to {PHASE_LABEL[PHASES[PHASES.indexOf(activeCycle.phase)+1]] ?? '—'}
                        </Button>
                      )}
                      <Button size="sm" className="w-full" variant="secondary"
                        onClick={() => { setUploadCycleId(activeCycle.id); fileRef.current?.click() }}>
                        ↑ Upload Assignment Matrix
                      </Button>
                      {['CONSOLIDATION','INTERVIEW'].includes(activeCycle.phase) && !activeCycle.resultsReleasedAt && (
                        <Button size="sm" className="w-full"
                          onClick={() => { if (confirm('Release results to all employees?')) releaseMutation.mutate(activeCycle.id) }}>
                          Release Results
                        </Button>
                      )}
                      {activeCycle.resultsReleasedAt && (
                        <p className="text-xs text-green-600 font-medium text-center">Results released ✓</p>
                      )}
                      <Link href={`/analytics?cycleId=${activeCycle.id}`}
                        className="block text-center text-xs text-[#C30017] font-medium hover:underline pt-1">
                        View Analytics →
                      </Link>
                      <Link href={`/analytics/staff`}
                        className="block text-center text-xs text-[#C30017] font-medium hover:underline">
                        Staff Progress →
                      </Link>
                    </div>
                  </Card>

                  {/* Totals */}
                  {activity && (
                    <Card>
                      <div className="p-4 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Completion</p>
                        {[
                          { label:'Assigned',       v: activity.totals.assigned,  total: activity.totals.assigned },
                          { label:'Self-appraisals', v: activity.totals.selfDone,  total: activity.totals.assigned },
                          { label:'Evaluations E1',  v: activity.totals.eval1Done, total: activity.totals.assigned },
                          { label:'Evaluations E2',  v: activity.totals.eval2Done, total: activity.totals.assigned },
                        ].map(({ label, v, total }) => (
                          <div key={label}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-600">{label}</span>
                              <span className="font-medium">{v}/{total}</span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full">
                              <div className="h-1.5 bg-[#C30017] rounded-full transition-all"
                                style={{ width: total ? `${(v/total)*100}%` : '0%' }}/>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Right: live activity table (2 cols) */}
                <div className="col-span-2">
                  <Card>
                    <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-800 text-sm">Live Activity</h3>
                      <span className="text-xs text-gray-400">{activity?.employees.length ?? 0} employees · auto-refresh 30s</span>
                    </div>
                    <div className="overflow-auto max-h-[600px]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-gray-100">
                          <tr className="text-gray-500 uppercase tracking-wide">
                            <th className="px-4 py-2 text-left">Employee</th>
                            <th className="px-3 py-2 text-left">Team</th>
                            <th className="px-3 py-2 text-left">Grade</th>
                            <th className="px-3 py-2 text-center">Self</th>
                            <th className="px-3 py-2 text-center">E1</th>
                            <th className="px-3 py-2 text-center">E2</th>
                            <th className="px-3 py-2 text-left">Evaluators</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activity?.employees.map((row, i) => {
                            const allDone = row.self?.status==='SUBMITTED' && row.eval1?.status==='SUBMITTED' && row.eval2?.status==='SUBMITTED'
                            return (
                              <tr key={row.employee.id}
                                className={`border-b border-gray-50 hover:bg-gray-50 ${allDone ? 'bg-green-50/30' : ''}`}>
                                <td className="px-4 py-2.5">
                                  <div className="font-medium text-gray-900">{row.employee.fullName}</div>
                                  <div className="text-gray-400 font-mono">{row.employee.juruId ?? '—'}</div>
                                </td>
                                <td className="px-3 py-2.5 text-gray-500">{row.employee.team?.name ?? '—'}</td>
                                <td className="px-3 py-2.5">
                                  <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{row.employee.grade}</span>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <StatusDot status={row.self?.status}/>
                                    {row.self?.updatedAt && (
                                      <span className="text-gray-300">{new Date(row.self.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <StatusDot status={row.eval1?.status}/>
                                    {row.eval1?.updatedAt && (
                                      <span className="text-gray-300">{new Date(row.eval1.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <StatusDot status={row.eval2?.status}/>
                                    {row.eval2?.updatedAt && (
                                      <span className="text-gray-300">{new Date(row.eval2.updatedAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-gray-500">
                                  <div>{row.evaluator1.fullName} <span className="text-gray-300">(70%)</span></div>
                                  <div>{row.evaluator2.fullName} <span className="text-gray-300">(30%)</span></div>
                                </td>
                              </tr>
                            )
                          })}
                          {!activity?.employees.length && (
                            <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                              No assignments yet — upload the assignment matrix to see activity
                            </td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── EMPLOYEES TAB ─────────────────────────────────────────────────── */}
        {tab === 'employees' && (
          <div className="space-y-4">
            {/* Email warning banner */}
            {emailStats && emailStats.withPlaceholderEmail > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-start gap-3">
                <span className="text-amber-500 text-lg shrink-0">⚠</span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    {emailStats.withPlaceholderEmail} employees have auto-generated placeholder emails
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    These were created from Juru IDs (e.g. lo15001@juru.org) and cannot receive email notifications.
                    Click any email cell below to edit it, or re-import an updated Excel file with a dedicated email column.
                  </p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input value={empSearch} onChange={e=>setEmpSearch(e.target.value)} placeholder="Search name or Juru ID…"
                  className="pl-8 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-60 focus:outline-none focus:ring-2 focus:ring-[#C30017]"/>
              </div>
              <select value={empBU} onChange={e=>setEmpBU(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                <option value="">All Business Units</option>
                {bus?.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {/* Table grouped by BU */}
            {Object.entries(byBU).sort().map(([buName, emps]) => (
              <Card key={buName}>
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="font-semibold text-gray-800 text-sm">{buName}</span>
                  <span className="text-xs text-gray-400">{emps.length} staff</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-5 py-2 text-left">Juru ID</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Email <span className="normal-case text-gray-400">(click to edit)</span></th>
                        <th className="px-4 py-2 text-left">Position</th>
                        <th className="px-4 py-2 text-left">Team</th>
                        <th className="px-4 py-2 text-center">Grade</th>
                        <th className="px-4 py-2 text-center">Role <span className="normal-case text-gray-400">(click to change)</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {emps.map((emp, i) => (
                        <tr key={emp.id} className={`border-b border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/30'}`}>
                          <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{emp.juruId ?? '—'}</td>
                          <td className="px-4 py-2.5 font-medium text-gray-900">{emp.fullName}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              {isPlaceholder(emp.email) && (
                                <span title="Placeholder email — cannot receive notifications" className="text-amber-400 shrink-0">⚠</span>
                              )}
                              <EditableCell
                                value={emp.email}
                                placeholder="Add real email…"
                                type="email"
                                onSave={v => updateEmpMutation.mutate({ id: emp.id, data: { email: v } })}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[180px] truncate">{emp.position ?? '—'}</td>
                          <td className="px-4 py-2.5 text-gray-600 text-xs">{emp.team?.name ?? '—'}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{emp.grade}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <select
                              value={emp.role}
                              onChange={e => updateEmpMutation.mutate({ id: emp.id, data: { role: e.target.value as Employee['role'] } })}
                              className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C30017] ${ROLE_COLOR[emp.role] ?? 'bg-gray-100 text-gray-600'}`}
                            >
                              {ALL_ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── STAFF PROGRESS TAB ────────────────────────────────────────────── */}
        {tab === 'progress' && (
          <StaffProgressTab cycleId={activeCycleId} cycles={cycles ?? []} bus={bus ?? []} />
        )}

        {/* ── ACCESS MATRIX TAB ─────────────────────────────────────────────── */}
        {tab === 'access' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500">What each role can see and do in the platform.</p>
            <div className="grid grid-cols-3 gap-4">
              {ALL_ROLES.map(role => (
                <Card key={role}>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_COLOR[role]}`}>
                        {role.replace(/_/g,' ')}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {ROLE_ACCESS[role].map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                          <svg className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                          </svg>
                          {item}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 font-medium mb-1.5">Employees with this role:</p>
                      <p className="text-lg font-bold text-gray-800">
                        {employees?.filter(e=>e.role===role).length ?? '—'}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            <Card>
              <div className="p-5">
                <h3 className="font-semibold text-gray-800 mb-4">All roles at a glance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="py-2 text-left pr-6">Feature</th>
                        {ALL_ROLES.map(r=>(
                          <th key={r} className="py-2 text-center px-3 whitespace-nowrap">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[r]}`}>{r.replace(/_/g,' ')}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Email notifications',      true,  false, true,  true,  true,  true ],
                        ['Notification feed',         true,  true,  true,  true,  true,  true ],
                        ['Self-appraisal form',       false, false, false, false, false, false],
                        ['Evaluations panel',         false, true,  false, false, false, false],
                        ['Staff Progress tracker',    false, false, true,  true,  true,  true ],
                        ['Analytics & charts',        false, false, true,  true,  true,  true ],
                        ['Interview notes',           false, false, true,  false, false, false],
                        ['Cycle management',          false, false, false, false, false, true ],
                        ['Employee import & roles',   false, false, false, false, false, true ],
                        ['Reports download',          false, false, false, true,  true,  true ],
                      ].map(([feat, ...perRole]) => (
                        <tr key={feat as string} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 pr-6 text-gray-700">{feat}</td>
                          {perRole.map((has, j) => (
                            <td key={j} className="py-2.5 text-center px-3">
                              {has
                                ? <svg className="w-4 h-4 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                                : <span className="text-gray-200">—</span>
                              }
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Hidden inputs */}
        <input ref={fileRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f=e.target.files?.[0]; if(f&&uploadCycleId) handleMatrixUpload(uploadCycleId,f); e.target.value='' }}/>
      </div>
    </Shell>
  )
}
