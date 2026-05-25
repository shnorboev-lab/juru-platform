'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = { id: string; fullName: string; email: string; grade: string; juruId?: string }
type Assignment = {
  id: string; cycleId: string; employeeId: string
  employee:   { id: string; fullName: string; email: string; grade: string; juruId?: string; team?: { name: string }; bu?: { id: string; name: string } }
  evaluator1: { id: string; fullName: string; email: string }
  evaluator2: { id: string; fullName: string; email: string }
}
type Submission = { employeeId: string; type: string; status: string }
type Result = {
  employeeId: string; overallAvg: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean
}
type Cycle = { id: string; label: string; phase: string; evaluationEnd: string; consolidationEnd: string; interviewEnd: string }

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL:           'bg-green-100 text-green-800',
  EXCEEDS_EXPECTATIONS:  'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS:    'bg-blue-100 text-blue-700',
  PARTIALLY_MEETS:       'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS:    'bg-red-100 text-red-700',
}
const LABEL_SHORT: Record<string, string> = {
  EXCEPTIONAL:           'Exceptional',
  EXCEEDS_EXPECTATIONS:  'Exceeds',
  MEETS_EXPECTATIONS:    'Meets',
  PARTIALLY_MEETS:       'Partially',
  BELOW_EXPECTATIONS:    'Below',
}

// ─── Evaluator dropdown ───────────────────────────────────────────────────────

function EvaluatorCell({ current, allEmployees, onSave, weight }: {
  current: { id: string; fullName: string }
  allEmployees: Employee[]
  onSave: (id: string) => void
  weight: string
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])
  const filtered = allEmployees.filter(e => e.fullName.toLowerCase().includes(q.toLowerCase()) || e.email.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
  return (
    <div ref={ref} className="relative">
      <button onClick={() => { setOpen(!open); setQ('') }}
        className="text-sm text-gray-700 hover:text-[#C30017] text-left flex items-center gap-1 group">
        <span className="group-hover:underline">{current.fullName}</span>
        <span className="text-xs text-gray-400">({weight})</span>
        <svg className="w-3 h-3 text-gray-300 group-hover:text-[#C30017]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.map(e => (
              <button key={e.id} onClick={() => { onSave(e.id); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${e.id === current.id ? 'font-semibold text-[#C30017]' : 'text-gray-700'}`}>
                <span>{e.fullName}</span>
                <span className="text-xs text-gray-400 font-mono">{e.grade}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-4 text-xs text-gray-400 text-center">No matches</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Add Assignment Modal ─────────────────────────────────────────────────────

function AddAssignmentModal({ allEmployees, onSave, onClose }: {
  allEmployees: Employee[]; onSave: (d: { employeeId: string; evaluator1Id: string; evaluator2Id: string }) => void; onClose: () => void
}) {
  const [empId, setEmpId]   = useState('')
  const [e1Id,  setE1Id]    = useState('')
  const [e2Id,  setE2Id]    = useState('')
  const [empQ,  setEmpQ]    = useState('')
  const [e1Q,   setE1Q]     = useState('')
  const [e2Q,   setE2Q]     = useState('')

  const empList = allEmployees.filter(e => e.fullName.toLowerCase().includes(empQ.toLowerCase())).slice(0, 8)
  const e1List  = allEmployees.filter(e => e.fullName.toLowerCase().includes(e1Q.toLowerCase())).slice(0, 8)
  const e2List  = allEmployees.filter(e => e.fullName.toLowerCase().includes(e2Q.toLowerCase())).slice(0, 8)

  function SearchSelect({ label, value, query, setQuery, list, onSelect }: {
    label: string; value: string; query: string; setQuery: (v: string) => void; list: Employee[]; onSelect: (id: string) => void
  }) {
    const selected = allEmployees.find(e => e.id === value)
    return (
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
        {selected ? (
          <div className="flex items-center justify-between border border-green-300 bg-green-50 rounded-lg px-3 py-2 text-sm">
            <span className="font-medium text-gray-900">{selected.fullName}</span>
            <button onClick={() => { onSelect(''); setQuery('') }} className="text-gray-400 hover:text-red-500 ml-2">×</button>
          </div>
        ) : (
          <div>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={`Search ${label}…`}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
            {query && (
              <div className="border border-gray-200 rounded-lg mt-1 max-h-36 overflow-y-auto bg-white shadow-sm">
                {list.map(e => (
                  <button key={e.id} onClick={() => { onSelect(e.id); setQuery('') }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between">
                    <span>{e.fullName}</span>
                    <span className="text-xs text-gray-400 font-mono">{e.grade}</span>
                  </button>
                ))}
                {list.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No matches</p>}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">Add Employee to Cycle</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <SearchSelect label="Employee" value={empId} query={empQ} setQuery={setEmpQ} list={empList} onSelect={setEmpId} />
        <SearchSelect label="Evaluator 1 (70%)" value={e1Id} query={e1Q} setQuery={setE1Q} list={e1List} onSelect={setE1Id} />
        <SearchSelect label="Evaluator 2 (30%)" value={e2Id} query={e2Q} setQuery={setE2Q} list={e2List} onSelect={setE2Id} />
        <div className="flex gap-3 pt-1">
          <Button disabled={!empId || !e1Id || !e2Id} onClick={() => onSave({ employeeId: empId, evaluator1Id: e1Id, evaluator2Id: e2Id })}>
            Add to Cycle
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Share Results Panel ──────────────────────────────────────────────────────

function ShareResultsPanel({ assignments, resultsMap, onConfirm, onCancel, loading }: {
  assignments: Assignment[]
  resultsMap: Map<string, Result>
  onConfirm: (employeeIds: string[]) => void
  onCancel: () => void
  loading: boolean
}) {
  const readyToShare = assignments.filter(a => resultsMap.has(a.employeeId))
  const [selected, setSelected] = useState<Set<string>>(() => new Set(readyToShare.map(a => a.employeeId)))

  return (
    <Card>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Share Consolidated Results</h3>
          <p className="text-sm text-gray-500 mt-0.5">Selected employees + their team/BU heads will be notified</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{selected.size} employees selected</span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 ml-2 text-xl leading-none">×</button>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {readyToShare.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No calculated results yet — click "Calculate Scores" first.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={readyToShare.every(a => selected.has(a.employeeId))}
                  onChange={ev => setSelected(ev.target.checked ? new Set(readyToShare.map(a => a.employeeId)) : new Set())}
                  className="w-4 h-4 accent-[#C30017]" />
                <span className="text-sm text-gray-600">Select all with scores</span>
              </label>
            </div>
            <div className="border border-gray-100 rounded-xl max-h-72 overflow-y-auto divide-y divide-gray-50">
              {readyToShare.map(a => {
                const r = resultsMap.get(a.employeeId)!
                return (
                  <label key={a.employeeId} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${selected.has(a.employeeId) ? '' : 'opacity-40'}`}>
                    <input type="checkbox" checked={selected.has(a.employeeId)}
                      onChange={ev => { const s = new Set(selected); ev.target.checked ? s.add(a.employeeId) : s.delete(a.employeeId); setSelected(s) }}
                      className="w-4 h-4 accent-[#C30017] shrink-0" />
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-gray-900">{a.employee.fullName}</span>
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{a.employee.grade}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-gray-900">{r.overallAvg.toFixed(2)}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLOR[r.performanceLabel]}`}>
                        {LABEL_SHORT[r.performanceLabel]}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
          </>
        )}
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">Employee + team head + BU head will each receive a notification</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button loading={loading} disabled={selected.size === 0}
              onClick={() => onConfirm([...selected])}>
              Share to {selected.size}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}

// ─── Timeline Editor ─────────────────────────────────────────────────────────

function TimelineEditor({ fields, onSave, saving }: {
  fields: { label: string; key: string; value: string }[]
  onSave: (d: Record<string, string>) => void
  saving: boolean
}) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(f => [f.key, f.value?.slice(0, 10) ?? '']))
  )
  useEffect(() => {
    setVals(Object.fromEntries(fields.map(f => [f.key, f.value?.slice(0, 10) ?? ''])))
  }, [fields.map(f => f.value).join()])
  const dirty = fields.some(f => vals[f.key] !== (f.value?.slice(0, 10) ?? ''))
  return (
    <div className="flex items-end gap-4 flex-wrap">
      {fields.map(f => (
        <div key={f.key}>
          <label className="text-xs font-medium text-gray-500 block mb-1">{f.label}</label>
          <input type="date" value={vals[f.key] ?? ''} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>
      ))}
      {dirty && <Button size="sm" loading={saving} onClick={() => onSave(vals)}>Save Timeline</Button>}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvaluationsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [buFilter, setBuFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showNotifyPanel, setShowNotifyPanel] = useState(false)
  const [showSharePanel, setShowSharePanel]   = useState(false)
  const [showAddModal, setShowAddModal]       = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ text: string; type: 'success' | 'warn' | 'error' } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const updateCycleMutation = useMutation({
    mutationFn: (d: Record<string, string>) => api.patch(`/cycles/${cycleId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); showToast('Timeline saved') },
  })

  const { data: assignments, isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments', cycleId],
    queryFn: () => api.get(`/assignments?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })
  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ['submissions-eval', cycleId],
    queryFn: () => api.get(`/submissions?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId, refetchInterval: 30_000,
  })
  const { data: results, refetch: refetchResults } = useQuery<Result[]>({
    queryKey: ['results', cycleId],
    queryFn: () => api.get(`/results?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId, refetchInterval: 30_000,
  })
  const { data: allEmployees } = useQuery<Employee[]>({
    queryKey: ['employees-all'],
    queryFn: () => api.get('/employees?isActive=true').then(r => r.data),
    enabled: !!me,
  })
  const { data: bus } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['business-units'],
    queryFn: () => api.get('/employees/meta/business-units').then(r => r.data), enabled: !!me,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { evaluator1Id?: string; evaluator2Id?: string } }) =>
      api.patch(`/assignments/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments', cycleId] }); showToast('Evaluator updated') },
  })
  const addMutation = useMutation({
    mutationFn: (d: { employeeId: string; evaluator1Id: string; evaluator2Id: string }) =>
      api.post('/assignments', { ...d, cycleId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assignments', cycleId] }); setShowAddModal(false); showToast('Employee added to cycle') },
  })
  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/assignments/approve', { cycleId, evaluatorIds: ids }),
    onSuccess: (res) => { setShowNotifyPanel(false); showToast(`Notified ${(res.data as { notified: number }).notified} evaluators`) },
  })
  const calculateMutation = useMutation({
    mutationFn: () => api.post('/results/calculate', { cycleId }),
    onSuccess: (res) => {
      refetchResults()
      showToast(`Calculated scores for ${(res.data as { calculated: number }).calculated} employees`)
    },
  })
  const shareMutation = useMutation({
    mutationFn: (employeeIds: string[]) => api.post('/results/share', { cycleId, employeeIds }),
    onSuccess: (res) => {
      setShowSharePanel(false)
      showToast(`Results shared — ${(res.data as { notified: number }).notified} notifications sent`)
    },
  })

  async function handleUpload(file: File) {
    setUploadMsg(null)
    try {
      const form = new FormData(); form.append('file', file)
      const r = await api.post(`/assignments/upload?cycleId=${cycleId}`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const d = r.data as { ok: number; errors: { name: string; error: string }[] }
      setUploadMsg({ text: `${d.ok} assignments imported${d.errors.length ? ` · ${d.errors.length} errors` : ''}`, type: d.errors.length ? 'warn' : 'success' })
      qc.invalidateQueries({ queryKey: ['assignments', cycleId] })
    } catch (e: unknown) {
      setUploadMsg({ text: (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Upload failed', type: 'error' })
    }
  }

  if (!me) return null

  const activeCycle = cycles?.find(c => c.id === cycleId)
  const resultsMap  = new Map((results ?? []).map(r => [r.employeeId, r]))
  const e1Done = new Set((submissions ?? []).filter(s => s.type === 'EVAL_1' && s.status === 'SUBMITTED').map(s => s.employeeId))
  const e2Done = new Set((submissions ?? []).filter(s => s.type === 'EVAL_2' && s.status === 'SUBMITTED').map(s => s.employeeId))
  const bothDone = (assignments ?? []).filter(a => e1Done.has(a.employeeId) && e2Done.has(a.employeeId)).length

  const filtered = (assignments ?? []).filter(a =>
    (!buFilter || a.employee.bu?.name === buFilter) &&
    (!search   || a.employee.fullName.toLowerCase().includes(search.toLowerCase()) || (a.employee.juruId ?? '').toLowerCase().includes(search.toLowerCase()))
  )
  const byBU = filtered.reduce<Record<string, Assignment[]>>((acc, a) => {
    const k = a.employee.bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(a); return acc
  }, {})

  const uniqueEvaluators: Employee[] = []
  const evalIdSet = new Set<string>()
  for (const a of (assignments ?? [])) {
    if (!evalIdSet.has(a.evaluator1.id)) { evalIdSet.add(a.evaluator1.id); uniqueEvaluators.push(a.evaluator1) }
    if (!evalIdSet.has(a.evaluator2.id)) { evalIdSet.add(a.evaluator2.id); uniqueEvaluators.push(a.evaluator2) }
  }

  const BUs = [...new Set((assignments ?? []).map(a => a.employee.bu?.name ?? 'Unassigned'))].sort()

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-5">

        {/* Toast */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">✓ {toast}</div>
        )}

        {/* Add Assignment Modal */}
        {showAddModal && allEmployees && (
          <AddAssignmentModal allEmployees={allEmployees}
            onSave={d => addMutation.mutate(d)}
            onClose={() => setShowAddModal(false)} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Evaluations</h1>
            <p className="text-sm text-gray-500 mt-1">Upload matrix or add individually · edit evaluators · share results</p>
          </div>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Action bar */}
        <Card>
          <div className="p-5 flex items-center gap-3 flex-wrap">
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Evaluation Period</p>
              {activeCycle && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      activeCycle.phase === 'EVALUATION' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      {activeCycle.phase === 'EVALUATION' ? 'Active' : activeCycle.phase}
                    </span>
                  </div>
                  <TimelineEditor
                    fields={[
                      { label: 'Evaluation Deadline',    key: 'evaluationEnd',    value: activeCycle.evaluationEnd    },
                      { label: 'Consolidation Deadline', key: 'consolidationEnd', value: activeCycle.consolidationEnd },
                      { label: 'Interview Deadline',     key: 'interviewEnd',     value: activeCycle.interviewEnd     },
                    ]}
                    onSave={d => updateCycleMutation.mutate(d)}
                    saving={updateCycleMutation.isPending}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap shrink-0">
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>↑ Upload Matrix</Button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
              <Button variant="secondary" onClick={() => setShowAddModal(true)}>+ Add Employee</Button>
              {(assignments?.length ?? 0) > 0 && (
                <Button variant="secondary" onClick={() => setShowNotifyPanel(v => !v)}>✓ Notify Evaluators</Button>
              )}
              {bothDone > 0 && (
                <Button variant="secondary" loading={calculateMutation.isPending}
                  onClick={() => calculateMutation.mutate()}>
                  ⟳ Calculate Scores ({bothDone})
                </Button>
              )}
              {resultsMap.size > 0 && (
                <Button onClick={() => setShowSharePanel(v => !v)}>
                  Share Results ({resultsMap.size})
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Feedback */}
        {uploadMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            uploadMsg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700'
            : uploadMsg.type === 'warn' ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-green-50 border border-green-200 text-green-800'}`}>
            {uploadMsg.text}
            <button onClick={() => setUploadMsg(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Notify Panel */}
        {showNotifyPanel && (
          <Card>
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Notify Evaluators</h3>
                <button onClick={() => setShowNotifyPanel(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{uniqueEvaluators.length} evaluators assigned · all will be notified to complete their evaluations</p>
              <div className="border border-gray-100 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-50 mb-4">
                {uniqueEvaluators.map(e => (
                  <div key={e.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-900">{e.fullName}</span>
                    <span className="text-xs text-gray-400">{e.email}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setShowNotifyPanel(false)}>Cancel</Button>
                <Button loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(uniqueEvaluators.map(e => e.id))}>
                  Approve & Send to All {uniqueEvaluators.length}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Share Results Panel */}
        {showSharePanel && assignments && (
          <ShareResultsPanel
            assignments={assignments}
            resultsMap={resultsMap}
            loading={shareMutation.isPending}
            onConfirm={ids => shareMutation.mutate(ids)}
            onCancel={() => setShowSharePanel(false)} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Assigned',       value: assignments?.length ?? 0, color: 'text-gray-900' },
            { label: 'E1 Submitted',   value: e1Done.size,              color: 'text-blue-600'  },
            { label: 'E2 Submitted',   value: e2Done.size,              color: 'text-blue-600'  },
            { label: 'Scores Calculated', value: resultsMap.size,       color: 'text-green-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee name or Juru ID…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
          </div>
          <select value={buFilter} onChange={e => setBuFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            <option value="">All BUs</option>
            {BUs.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {isLoading && <p className="text-gray-400 text-sm py-4">Loading…</p>}

        {!isLoading && (assignments?.length ?? 0) === 0 && (
          <Card>
            <div className="p-12 text-center space-y-2">
              <p className="text-gray-500 text-sm font-medium">No assignments yet</p>
              <p className="text-gray-400 text-xs">Upload an Excel (Email · Evaluator 1 (70%) Email · Evaluator 2 (30%) Email) or click "+ Add Employee"</p>
            </div>
          </Card>
        )}

        {/* Tables grouped by BU */}
        {Object.entries(byBU).sort().map(([buName, rows]) => (
          <Card key={buName}>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <h3 className="font-semibold text-gray-800">{buName}</h3>
              <span className="text-xs text-gray-400">
                {rows.filter(a => e1Done.has(a.employeeId) && e2Done.has(a.employeeId)).length}/{rows.length} evaluations complete
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-5 py-2 text-left font-medium">Employee</th>
                    <th className="px-3 py-2 text-left font-medium">Team</th>
                    <th className="px-3 py-2 text-center font-medium">Grade</th>
                    <th className="px-3 py-2 text-left font-medium">Evaluator 1 (70%)</th>
                    <th className="px-3 py-2 text-center font-medium">E1</th>
                    <th className="px-3 py-2 text-left font-medium">Evaluator 2 (30%)</th>
                    <th className="px-3 py-2 text-center font-medium">E2</th>
                    <th className="px-3 py-2 text-center font-medium">Consolidated</th>
                    <th className="px-3 py-2 text-center font-medium">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(a => {
                    const s1  = e1Done.has(a.employeeId) ? 'SUBMITTED' : ((submissions ?? []).find(s => s.employeeId === a.employeeId && s.type === 'EVAL_1')?.status ?? 'PENDING')
                    const s2  = e2Done.has(a.employeeId) ? 'SUBMITTED' : ((submissions ?? []).find(s => s.employeeId === a.employeeId && s.type === 'EVAL_2')?.status ?? 'PENDING')
                    const res = resultsMap.get(a.employeeId)
                    const allDone = s1 === 'SUBMITTED' && s2 === 'SUBMITTED'
                    return (
                      <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${allDone ? 'bg-green-50/20' : ''}`}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-gray-900">{a.employee.fullName}</div>
                          {a.employee.juruId && <div className="text-xs font-mono text-gray-400">{a.employee.juruId}</div>}
                        </td>
                        <td className="px-3 py-3 text-gray-500 text-xs">{a.employee.team?.name ?? '—'}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{a.employee.grade}</span>
                        </td>
                        <td className="px-3 py-3">
                          <EvaluatorCell current={a.evaluator1} allEmployees={allEmployees ?? []} weight="70%"
                            onSave={id => updateMutation.mutate({ id: a.id, data: { evaluator1Id: id } })} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            s1 === 'SUBMITTED' ? 'bg-green-100 text-green-700' :
                            s1 === 'DRAFT'     ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                            {s1 === 'SUBMITTED' ? '✓' : s1 === 'DRAFT' ? '…' : '–'}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <EvaluatorCell current={a.evaluator2} allEmployees={allEmployees ?? []} weight="30%"
                            onSave={id => updateMutation.mutate({ id: a.id, data: { evaluator2Id: id } })} />
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                            s2 === 'SUBMITTED' ? 'bg-green-100 text-green-700' :
                            s2 === 'DRAFT'     ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                            {s2 === 'SUBMITTED' ? '✓' : s2 === 'DRAFT' ? '…' : '–'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {res ? (
                            <span className="text-sm font-bold text-gray-900">{Number(res.overallAvg).toFixed(2)}</span>
                          ) : allDone ? (
                            <span className="text-xs text-gray-400">Click Calculate</span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {res ? (
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLOR[res.performanceLabel]}`}>
                                {LABEL_SHORT[res.performanceLabel]}
                              </span>
                              {res.isAtRisk    && <span className="text-xs text-red-400">⚠ At risk</span>}
                              {res.isNominated && <span className="text-xs text-green-500">★ Nominated</span>}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  )
}
