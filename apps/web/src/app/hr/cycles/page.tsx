'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

type BU = { id: string; name: string }
type Cycle = {
  id: string; label: string; type: string; year: number; phase: string
  selfAppraisalStart: string; selfAppraisalEnd: string
  evaluationEnd: string; consolidationEnd: string; interviewEnd: string
  bu: { name: string }
}
type EmpStatus = {
  employee:   { id: string; fullName: string; juruId?: string; grade: string; team?: { name: string } }
  evaluator1: { id: string; fullName: string } | null
  evaluator2: { id: string; fullName: string } | null
  self:   { status: string; updatedAt: string } | null
  eval1:  { status: string; updatedAt: string } | null
  eval2:  { status: string; updatedAt: string } | null
}
type Activity = {
  cycle: Cycle
  totals: { assigned: number; selfDone: number; selfDraft: number; eval1Done: number; eval2Done: number }
  employees: EmpStatus[]
}

const PHASE_ORDER = ['PREP', 'SELF_APPRAISAL', 'EVALUATION', 'CONSOLIDATION', 'INTERVIEW', 'DONE']
const PHASE_LABEL: Record<string, string> = {
  PREP: 'Preparation', SELF_APPRAISAL: 'Self-Appraisal', EVALUATION: 'Evaluation',
  CONSOLIDATION: 'Consolidation', INTERVIEW: 'Interview', DONE: 'Done',
}
const PHASE_COLOR: Record<string, string> = {
  PREP: 'bg-gray-100 text-gray-600',
  SELF_APPRAISAL: 'bg-blue-100 text-blue-700',
  EVALUATION: 'bg-amber-100 text-amber-700',
  CONSOLIDATION: 'bg-purple-100 text-purple-700',
  INTERVIEW: 'bg-indigo-100 text-indigo-700',
  DONE: 'bg-green-100 text-green-700',
}

function fmt(iso: string) { return iso ? iso.slice(0, 10) : '—' }

function StatusDot({ status }: { status?: string | null }) {
  if (!status) return <span className="text-xs text-gray-300">—</span>
  if (status === 'SUBMITTED') return <span className="text-xs font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">✓</span>
  if (status === 'DRAFT')     return <span className="text-xs font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">…</span>
  return <span className="text-xs text-gray-300">—</span>
}

// ─── Editable Timeline ────────────────────────────────────────────────────────

function TimelineRow({ cycle, onSaved }: { cycle: Cycle; onSaved: () => void }) {
  const fields = [
    { key: 'selfAppraisalStart', label: 'SA Opens',       value: cycle.selfAppraisalStart },
    { key: 'selfAppraisalEnd',   label: 'SA Closes',      value: cycle.selfAppraisalEnd   },
    { key: 'evaluationEnd',      label: 'Eval End',       value: cycle.evaluationEnd       },
    { key: 'consolidationEnd',   label: 'Consol. End',    value: cycle.consolidationEnd    },
    { key: 'interviewEnd',       label: 'Interview End',  value: cycle.interviewEnd        },
  ]
  const [dates, setDates] = useState(() => Object.fromEntries(fields.map(f => [f.key, fmt(f.value)])))
  const [dirty, setDirty] = useState(false)
  const mutation = useMutation({
    mutationFn: () => api.patch(`/cycles/${cycle.id}`, dates),
    onSuccess: () => { setDirty(false); onSaved() },
  })
  const set = (k: string, v: string) => { setDates(d => ({ ...d, [k]: v })); setDirty(true) }
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Timeline</p>
      <div className="flex flex-wrap gap-3">
        {fields.map(f => (
          <div key={f.key}>
            <p className="text-xs text-gray-500 mb-1">{f.label}</p>
            <input type="date" value={(dates as Record<string,string>)[f.key]}
              onChange={e => set(f.key, e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
          </div>
        ))}
        {dirty && (
          <div className="flex items-end">
            <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
              className="text-xs px-3 py-1.5 bg-[#C30017] text-white rounded-lg hover:bg-[#a30014] font-medium disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cycle Detail Panel ───────────────────────────────────────────────────────

function CycleDetailPanel({ cycleId, onRefreshList }: { cycleId: string; onRefreshList: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }

  const { data: activity, isLoading } = useQuery<Activity>({
    queryKey: ['cycle-activity', cycleId],
    queryFn:  () => api.get(`/cycles/${cycleId}/activity`).then(r => r.data),
    refetchInterval: 30_000,
  })

  const advanceMutation = useMutation({
    mutationFn: (phase: string) => api.patch(`/cycles/${cycleId}/phase`, { phase }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cycle-activity', cycleId] })
      qc.invalidateQueries({ queryKey: ['cycles-detail'] })
      onRefreshList()
      showToast('Phase advanced')
    },
  })

  const calculateMutation = useMutation({
    mutationFn: () => api.post('/results/calculate', { cycleId }),
    onSuccess: (res) => showToast(`Calculated scores for ${(res.data as { calculated: number }).calculated} employees`),
  })

  if (isLoading) return <div className="px-6 py-6 text-sm text-gray-400">Loading…</div>
  if (!activity) return null

  const { cycle, totals, employees } = activity
  const phaseIdx  = PHASE_ORDER.indexOf(cycle.phase)
  const nextPhase = phaseIdx < PHASE_ORDER.length - 1 ? PHASE_ORDER[phaseIdx + 1] : null

  const filtered = employees.filter(e =>
    !search || e.employee.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (e.employee.juruId ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const byTeam = filtered.reduce<Record<string, EmpStatus[]>>((acc, e) => {
    const k = e.employee.team?.name ?? 'Unassigned';
    (acc[k] ??= []).push(e); return acc
  }, {})

  return (
    <div className="border-t border-gray-100">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">✓ {toast}</div>
      )}

      <div className="px-6 py-5 space-y-6">

        {/* Phase pipeline */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Phase Pipeline</p>
          <div className="flex items-center gap-1 flex-wrap">
            {PHASE_ORDER.map((ph, i) => {
              const done    = i < phaseIdx
              const current = i === phaseIdx
              return (
                <div key={ph} className="flex items-center gap-1">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                    current ? PHASE_COLOR[ph] + ' border-current' :
                    done    ? 'bg-gray-100 text-gray-400 border-transparent line-through' :
                              'bg-white text-gray-300 border-gray-200'
                  }`}>
                    {PHASE_LABEL[ph]}
                  </span>
                  {i < PHASE_ORDER.length - 1 && (
                    <svg className="w-3 h-3 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  )}
                </div>
              )
            })}
            {nextPhase && cycle.phase !== 'DONE' && (
              <button
                onClick={() => { if (confirm(`Advance "${cycle.label}" to ${PHASE_LABEL[nextPhase]}? This will notify participants.`)) advanceMutation.mutate(nextPhase) }}
                disabled={advanceMutation.isPending}
                className="ml-2 text-xs px-3 py-1 bg-[#C30017] text-white rounded-full font-medium hover:bg-[#a30014] disabled:opacity-50">
                → Advance to {PHASE_LABEL[nextPhase]}
              </button>
            )}
          </div>
        </div>

        {/* Timeline */}
        <TimelineRow cycle={cycle} onSaved={() => { qc.invalidateQueries({ queryKey: ['cycles-detail'] }); onRefreshList() }} />

        {/* Stats */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Progress</p>
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Assigned',     value: totals.assigned,  color: 'text-gray-800' },
              { label: 'Self Done',    value: totals.selfDone,  color: 'text-blue-600' },
              { label: 'Self Draft',   value: totals.selfDraft, color: 'text-amber-600' },
              { label: 'E1 Done',      value: totals.eval1Done, color: 'text-purple-600' },
              { label: 'E2 Done',      value: totals.eval2Done, color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                <div className="mt-1.5 h-1 bg-gray-200 rounded-full">
                  <div className="h-1 bg-[#C30017] rounded-full"
                    style={{ width: totals.assigned ? `${Math.min(100, (s.value / totals.assigned) * 100)}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <Link href={`/hr/evaluations`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors">
            Manage Evaluators →
          </Link>
          <button onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors disabled:opacity-50">
            {calculateMutation.isPending ? 'Calculating…' : '⟳ Calculate Scores'}
          </button>
        </div>

        {/* Employee status table */}
        {employees.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Employees ({employees.length})</p>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#C30017] w-44" />
            </div>
            <div className="space-y-3">
              {Object.entries(byTeam).sort().map(([team, rows]) => (
                <div key={team}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-600">{team}</span>
                    <span className="text-xs text-gray-400">{rows.length} employees</span>
                  </div>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="px-4 py-2 text-left font-medium">Employee</th>
                          <th className="px-3 py-2 text-center font-medium">Grade</th>
                          <th className="px-3 py-2 text-left font-medium">Eval 1 (70%)</th>
                          <th className="px-3 py-2 text-left font-medium">Eval 2 (30%)</th>
                          <th className="px-3 py-2 text-center font-medium">Self</th>
                          <th className="px-3 py-2 text-center font-medium">E1</th>
                          <th className="px-3 py-2 text-center font-medium">E2</th>
                          <th className="px-3 py-2 text-center font-medium">Interview</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(row => {
                          const allEvalDone = row.eval1?.status === 'SUBMITTED' && row.eval2?.status === 'SUBMITTED'
                          return (
                            <tr key={row.employee.id}
                              className={`border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors ${allEvalDone ? 'bg-green-50/20' : ''}`}>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-gray-900 text-sm">{row.employee.fullName}</div>
                                {row.employee.juruId && <div className="text-xs font-mono text-gray-400">{row.employee.juruId}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{row.employee.grade}</span>
                              </td>
                              <td className="px-3 py-2.5 text-xs text-gray-600">{row.evaluator1?.fullName ?? '—'}</td>
                              <td className="px-3 py-2.5 text-xs text-gray-600">{row.evaluator2?.fullName ?? '—'}</td>
                              <td className="px-3 py-2.5 text-center"><StatusDot status={row.self?.status} /></td>
                              <td className="px-3 py-2.5 text-center"><StatusDot status={row.eval1?.status} /></td>
                              <td className="px-3 py-2.5 text-center"><StatusDot status={row.eval2?.status} /></td>
                              <td className="px-3 py-2.5 text-center">
                                <Link href={`/interviews/${row.employee.id}?cycleId=${cycleId}`}
                                  className="text-xs text-[#C30017] hover:underline">View →</Link>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {employees.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">
            No employees assigned yet. <Link href="/hr/evaluations" className="text-[#C30017] hover:underline">Go to Evaluations to add employees →</Link>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Create Cycle Modal ───────────────────────────────────────────────────────

function CreateCycleModal({ bus, onClose, onCreated }: {
  bus: BU[]; onClose: () => void; onCreated: (id: string) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    type: 'SEMI_ANNUAL', year: new Date().getFullYear(), label: '',
    buId: bus[0]?.id ?? '',
    selfAppraisalStart: today, selfAppraisalEnd: '',
    evaluationEnd: '', consolidationEnd: '', interviewEnd: '',
  })
  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }))
  const mutation = useMutation({
    mutationFn: () => api.post('/cycles', form),
    onSuccess: (res) => { onCreated(res.data.id); onClose() },
  })
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Create Review Cycle</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
              <option value="SEMI_ANNUAL">Semi-Annual</option>
              <option value="ANNUAL">Annual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Year</label>
            <input type="number" value={form.year} onChange={e => set('year', Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
          <input value={form.label} onChange={e => set('label', e.target.value)}
            placeholder="e.g. Semi-Annual 2026 — SBU"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Business Unit</label>
          <select value={form.buId} onChange={e => set('buId', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            {bus.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Timeline</p>
          {[
            { key: 'selfAppraisalStart', label: 'Self-Appraisal Opens' },
            { key: 'selfAppraisalEnd',   label: 'Self-Appraisal Closes' },
            { key: 'evaluationEnd',      label: 'Evaluation Deadline' },
            { key: 'consolidationEnd',   label: 'Consolidation Deadline' },
            { key: 'interviewEnd',       label: 'Interview Deadline' },
          ].map(f => (
            <div key={f.key} className="flex items-center gap-3 mb-2">
              <label className="text-xs text-gray-600 w-44 shrink-0">{f.label}</label>
              <input type="date" value={(form as Record<string, string | number>)[f.key] as string}
                onChange={e => set(f.key, e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
            </div>
          ))}
        </div>
        {mutation.isError && <p className="text-xs text-red-600">Failed to create cycle. Check all fields.</p>}
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending || !form.label || !form.buId}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Creating…' : 'Create Cycle'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HRCyclesPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles, isLoading, refetch } = useQuery<Cycle[]>({
    queryKey: ['cycles-detail'],
    queryFn:  () => api.get('/cycles').then(r => r.data),
    enabled:  !!me,
  })
  const { data: buData } = useQuery<{ id: string; name: string; teams: { id: string; name: string }[] }[]>({
    queryKey: ['meta-bus'],
    queryFn:  () => api.get('/employees/meta/business-units').then(r => r.data),
    enabled:  !!me,
  })
  const bus: BU[] = (buData ?? []).map(b => ({ id: b.id, name: b.name }))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/cycles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cycles-detail'] }),
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Review Cycles</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage performance review cycles</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>+ New Cycle</Button>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && !cycles?.length && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No cycles yet</p>
            <p className="text-sm mt-1">Create a review cycle to get started.</p>
          </div>
        )}

        <div className="space-y-3">
          {cycles?.map(cycle => {
            const isOpen = expanded === cycle.id
            return (
              <Card key={cycle.id}>
                {/* Header row — outer div handles expand, inner elements stop propagation for actions */}
                <div onClick={() => setExpanded(isOpen ? null : cycle.id)}
                  className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-gray-50/60 transition-colors select-none">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{cycle.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PHASE_COLOR[cycle.phase]}`}>
                        {PHASE_LABEL[cycle.phase]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {cycle.bu.name} · {cycle.type.replace('_', ' ')} {cycle.year}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">SA Opens</p>
                      <p className="text-xs font-medium text-gray-700">{fmt(cycle.selfAppraisalStart)}</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-gray-400">Interview End</p>
                      <p className="text-xs font-medium text-gray-700">{fmt(cycle.interviewEnd)}</p>
                    </div>
                    <button onClick={e => {
                        e.stopPropagation()
                        const warning = cycle.phase !== 'PREP'
                          ? `⚠️ This cycle is in ${PHASE_LABEL[cycle.phase]} phase.\n\nDeleting will permanently erase ALL submissions, evaluations, and results.\n\nType DELETE to confirm:`
                          : `Delete "${cycle.label}"? This cannot be undone.`
                        const input = cycle.phase !== 'PREP' ? prompt(warning) : null
                        if (cycle.phase !== 'PREP' && input !== 'DELETE') return
                        if (cycle.phase === 'PREP' && !confirm(warning)) return
                        deleteMutation.mutate(cycle.id)
                      }}
                      className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded border border-red-200 hover:border-red-400 transition-colors">
                      Delete
                    </button>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                    </svg>
                  </div>
                </div>

                {/* Detail panel */}
                {isOpen && (
                  <CycleDetailPanel
                    cycleId={cycle.id}
                    onRefreshList={() => refetch()}
                  />
                )}
              </Card>
            )
          })}
        </div>
      </div>

      {showCreate && bus.length > 0 && (
        <CreateCycleModal
          bus={bus}
          onClose={() => setShowCreate(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ['cycles-detail'] })}
        />
      )}
    </Shell>
  )
}
