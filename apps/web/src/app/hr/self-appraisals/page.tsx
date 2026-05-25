'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string; juruId?: string; fullName: string; email: string
  grade: string; position?: string; office?: string
  team?: { name: string }; bu?: { id: string; name: string }; buId?: string
  role: string; isActive: boolean
}
type Submission = { id: string; employeeId: string; status: string; submittedAt?: string; updatedAt: string }
type Cycle = { id: string; label: string; phase: string; selfAppraisalStart: string; selfAppraisalEnd: string; type: string; year: number; bu?: { name: string } }
type BU = { id: string; name: string; teams: { id: string; name: string }[] }

const GRADES = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4',
  'SE1','SE2','SE3','SE4','SC1','SC2','SC3','SC4','PE','PE1','PE2','PE3',
  'PC','PC1','PC2','M1','M2','M3','M4','SM1','SM2','SM3','SM4','D1','D2','D3','MD','I']

const STATUS_PILL: Record<string, string> = {
  SUBMITTED: 'bg-green-100 text-green-700',
  DRAFT:     'bg-amber-100 text-amber-700',
  PENDING:   'bg-gray-100 text-gray-500',
}

// ─── Add Employee Modal ───────────────────────────────────────────────────────

function AddEmployeeModal({ bus, onSave, onClose }: {
  bus: BU[]; onSave: (d: Record<string, string>) => void; onClose: () => void
}) {
  const [form, setForm] = useState({ juruId: '', fullName: '', email: '', grade: 'E1', buId: '', teamId: '', position: '', office: '' })
  const selectedBU = bus.find(b => b.id === form.buId)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-lg">Add Employee</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {([
            ['juruId',   'Juru ID',    'text',  'LO15001'],
            ['fullName', 'Full Name',  'text',  'Jane Smith'],
            ['email',    'Email',      'email', 'jane@juru.org'],
            ['position', 'Position',   'text',  'Senior Analyst'],
            ['office',   'Office',     'text',  'London'],
          ] as [keyof typeof form, string, string, string][]).map(([k, label, type, ph]) => (
            <div key={k} className={k === 'fullName' || k === 'email' ? 'col-span-2' : ''}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{label}</label>
              <input type={type} value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                placeholder={ph}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Grade</label>
            <select value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
              {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Business Unit</label>
            <select value={form.buId} onChange={e => setForm(f => ({ ...f, buId: e.target.value, teamId: '' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
              <option value="">— Select BU —</option>
              {bus.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {selectedBU && selectedBU.teams.length > 0 && (
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">Team</label>
              <select value={form.teamId} onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
                <option value="">— No team —</option>
                {selectedBU.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-1">
          <Button onClick={() => onSave(form as Record<string, string>)}>Add Employee</Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ─── Notify Panel ─────────────────────────────────────────────────────────────

function NotifyPanel({ employees, onConfirm, onCancel, loading }: {
  employees: Employee[]; onConfirm: (ids: string[]) => void; onCancel: () => void; loading: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(employees.map(e => e.id)))
  const [search, setSearch]     = useState('')
  const filtered = employees.filter(e => e.fullName.toLowerCase().includes(search.toLowerCase()) || (e.juruId ?? '').toLowerCase().includes(search.toLowerCase()))
  return (
    <Card>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">Notify Employees — Self-Appraisal Open</h3>
          <p className="text-sm text-gray-500 mt-0.5">Review and confirm who receives the notification email</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{selected.size} of {employees.length} selected</span>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 ml-2 text-xl leading-none">×</button>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={employees.every(e => selected.has(e.id))}
              onChange={ev => setSelected(ev.target.checked ? new Set(employees.map(e => e.id)) : new Set())}
              className="w-4 h-4 accent-[#C30017]" />
            <span className="text-sm text-gray-600">Select all</span>
          </label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
            className="flex-1 max-w-xs border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>
        <div className="border border-gray-100 rounded-xl max-h-72 overflow-y-auto divide-y divide-gray-50">
          {filtered.map(e => (
            <label key={e.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${selected.has(e.id) ? '' : 'opacity-40'}`}>
              <input type="checkbox" checked={selected.has(e.id)}
                onChange={ev => { const s = new Set(selected); ev.target.checked ? s.add(e.id) : s.delete(e.id); setSelected(s) }}
                className="w-4 h-4 accent-[#C30017] shrink-0" />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="font-medium text-sm text-gray-900">{e.fullName}</span>
                {e.juruId && <span className="font-mono text-xs text-gray-400">{e.juruId}</span>}
                <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{e.grade}</span>
                {e.bu && <span className="text-xs text-gray-400">{e.bu.name}</span>}
              </div>
              {!selected.has(e.id) && <span className="text-xs text-gray-300 shrink-0">Will not be notified</span>}
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1">
          <p className="text-sm text-gray-500">{selected.size} employees will receive a notification</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button loading={loading} onClick={() => onConfirm([...selected])}>Send to {selected.size}</Button>
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
      {dirty && (
        <Button size="sm" loading={saving} onClick={() => onSave(vals)}>Save Timeline</Button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SelfAppraisalsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [buFilter, setBuFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAddEmp, setShowAddEmp]     = useState(false)
  const [showNotifyPanel, setShowNotifyPanel] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])
  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000) }

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const { data: bus } = useQuery<BU[]>({
    queryKey: ['business-units'], queryFn: () => api.get('/employees/meta/business-units').then(r => r.data), enabled: !!me,
  })
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees-sa', search, buFilter],
    queryFn: () => api.get(`/employees?isActive=true${search ? `&search=${encodeURIComponent(search)}` : ''}${buFilter ? `&buId=${buFilter}` : ''}`).then(r => r.data),
    enabled: !!me,
    refetchInterval: 30_000,
  })
  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ['submissions-self', cycleId],
    queryFn: () => api.get(`/submissions?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
    refetchInterval: 30_000,
  })

  const updateCycleMutation = useMutation({
    mutationFn: (d: Record<string, string>) => api.patch(`/cycles/${cycleId}`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cycles'] }); showToast('Timeline saved') },
  })

  const addEmpMutation = useMutation({
    mutationFn: (d: Record<string, string>) => api.post('/employees', { ...d, role: 'EMPLOYEE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employees-sa'] }); setShowAddEmp(false); showToast('Employee added') },
  })
  const notifyMutation = useMutation({
    mutationFn: (ids: string[]) => api.post('/submissions/notify-all', { cycleId, employeeIds: ids }),
    onSuccess: (res) => { setShowNotifyPanel(false); showToast(`Notified ${(res.data as { notified: number }).notified} employees`) },
  })
  const shareAllMutation = useMutation({
    mutationFn: () => api.post('/submissions/share-all', { cycleId }),
    onSuccess: (res) => {
      const d = res.data as { shared: number; notified: number }
      showToast(`Shared ${d.shared} appraisals — ${d.notified} heads notified`)
    },
  })
  const shareMutation = useMutation({
    mutationFn: (empId: string) => api.post('/submissions/share-self-appraisal', { cycleId, employeeId: empId }),
    onSuccess: () => showToast('Shared with team/BU head'),
  })

  if (!me) return null

  const activeCycle  = cycles?.find(c => c.id === cycleId)
  const selfSubs     = (submissions ?? []).filter(s => (s as unknown as { type: string }).type === 'SELF' || !('type' in s))
  const submittedIds = new Set(selfSubs.filter(s => s.status === 'SUBMITTED').map(s => s.employeeId))
  const draftIds     = new Set(selfSubs.filter(s => s.status === 'DRAFT').map(s => s.employeeId))

  const submittedCount = (employees ?? []).filter(e => submittedIds.has(e.id)).length
  const draftCount     = (employees ?? []).filter(e => draftIds.has(e.id)).length
  const pendingCount   = (employees ?? []).filter(e => !submittedIds.has(e.id) && !draftIds.has(e.id)).length

  const byBU = (employees ?? []).reduce<Record<string, Employee[]>>((acc, e) => {
    const k = e.bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(e); return acc
  }, {})

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-5">

        {/* Toast */}
        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">✓ {toast}</div>
        )}

        {/* Modals */}
        {showAddEmp && bus && (
          <AddEmployeeModal bus={bus} onSave={d => addEmpMutation.mutate(d)} onClose={() => setShowAddEmp(false)} />
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Self-Appraisals</h1>
            <p className="text-sm text-gray-500 mt-1">{employees?.length ?? 0} employees</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setShowAddEmp(true)}>+ Add Employee</Button>
            <Link href="/hr/cycles"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-colors">
              Manage Cycles →
            </Link>
            <select value={cycleId} onChange={e => setCycleId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
              {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              {!cycles?.length && <option value="">No cycles yet</option>}
            </select>
          </div>
        </div>

        {/* Cycle timeline + actions */}
        <Card>
          <div className="p-5 space-y-4">
            {activeCycle ? (
              <>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      activeCycle.phase === 'SELF_APPRAISAL' ? 'bg-blue-100 text-blue-700'
                      : activeCycle.phase === 'DONE' ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'}`}>
                      {activeCycle.phase}
                    </span>
                    <span className="text-sm text-gray-500">{activeCycle.bu?.name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" disabled={!cycleId} onClick={() => setShowNotifyPanel(v => !v)}>
                      📩 Notify All Employees
                    </Button>
                    <Button disabled={submittedCount === 0} loading={shareAllMutation.isPending}
                      onClick={() => {
                        if (confirm(`Share all ${submittedCount} submitted self-appraisals with team and BU heads?`))
                          shareAllMutation.mutate()
                      }}>
                      Share All Submitted ({submittedCount})
                    </Button>
                  </div>
                </div>
                {/* Editable timeline */}
                <TimelineEditor
                  fields={[
                    { label: 'Self-Appraisal Start', key: 'selfAppraisalStart', value: activeCycle.selfAppraisalStart },
                    { label: 'Self-Appraisal End',   key: 'selfAppraisalEnd',   value: activeCycle.selfAppraisalEnd   },
                  ]}
                  onSave={d => updateCycleMutation.mutate(d)}
                  saving={updateCycleMutation.isPending}
                />
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">No cycle selected — <Link href="/hr/cycles" className="text-[#C30017] hover:underline">create one in Review Cycles</Link></p>
            )}
          </div>
        </Card>

        {/* Notify panel */}
        {showNotifyPanel && employees && (
          <NotifyPanel employees={employees} loading={notifyMutation.isPending}
            onConfirm={ids => notifyMutation.mutate(ids)}
            onCancel={() => setShowNotifyPanel(false)} />
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Submitted', value: submittedCount, color: 'text-green-600', bar: 'bg-green-500' },
            { label: 'In Draft',  value: draftCount,     color: 'text-amber-600', bar: 'bg-amber-400' },
            { label: 'Pending',   value: pendingCount,   color: 'text-gray-500',  bar: 'bg-gray-300'  },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full">
                <div className={`h-1.5 rounded-full ${s.bar}`}
                  style={{ width: (employees?.length ?? 0) ? `${(s.value / (employees?.length ?? 1)) * 100}%` : '0%' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or Juru ID…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
          </div>
          <select value={buFilter} onChange={e => setBuFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            <option value="">All BUs</option>
            {bus?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {isLoading && <p className="text-gray-400 text-sm py-4">Loading…</p>}

        {Object.entries(byBU).sort().map(([buName, emps]) => {
          const buSubmitted = emps.filter(e => submittedIds.has(e.id)).length
          return (
            <Card key={buName}>
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                <h3 className="font-semibold text-gray-800">{buName}</h3>
                <span className="text-xs text-gray-400">{buSubmitted}/{emps.length} submitted</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-2 text-left font-medium">Employee</th>
                      <th className="px-4 py-2 text-left font-medium">Team</th>
                      <th className="px-4 py-2 text-center font-medium">Grade</th>
                      <th className="px-4 py-2 text-center font-medium">Self-Appraisal</th>
                      <th className="px-4 py-2 text-center font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emps.map(emp => {
                      const sub    = selfSubs.find(s => s.employeeId === emp.id)
                      const status = sub?.status ?? 'PENDING'
                      return (
                        <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                          <td className="px-6 py-3">
                            <div className="font-medium text-gray-900">{emp.fullName}</div>
                            {emp.juruId && <div className="text-xs font-mono text-gray-400">{emp.juruId}</div>}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-sm">{emp.team?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-mono text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{emp.grade}</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_PILL[status]}`}>
                              {status === 'SUBMITTED' && sub?.submittedAt
                                ? `Submitted ${new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                                : status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {status === 'SUBMITTED' ? (
                              <Button size="sm" variant="secondary" onClick={() => shareMutation.mutate(emp.id)}>Share</Button>
                            ) : (
                              <span className="text-xs text-gray-300">Not submitted</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })}
      </div>
    </Shell>
  )
}
