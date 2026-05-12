'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ─── Constants ────────────────────────────────────────────────────────────────

const GRADES = [
  'E1','E2','E3','E4',
  'C1','C2','C3','C4',
  'S1','S2','S3','S4',
  'SE1','SE2','SE3','SE4',
  'SC1','SC2','SC3','SC4',
  'PE','PE1','PE2','PE3',
  'PC','PC1','PC2',
  'M1','M2','M3','M4',
  'SM1','SM2','SM3','SM4',
  'D1','D2','D3','MD','I',
]

const ROLES = ['EMPLOYEE','EVALUATOR','TEAM_HEAD','BU_HEAD','MD','HR_ADMIN']
const OFFICES = ['London','Tashkent','Remote','Other']

const ROLE_COLOR: Record<string, string> = {
  HR_ADMIN:  'bg-purple-100 text-purple-800',
  EVALUATOR: 'bg-amber-100 text-amber-700',
  TEAM_HEAD: 'bg-green-100 text-green-700',
  BU_HEAD:   'bg-orange-100 text-orange-700',
  MD:        'bg-red-100 text-red-700',
  EMPLOYEE:  'bg-blue-100 text-blue-700',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string; juruId?: string; fullName: string; email: string
  grade: string; position?: string; office?: string
  team?: { name: string }; bu?: { name: string }; buId?: string
  role: string; isActive: boolean
}
type BU = { id: string; name: string; teams: { id: string; name: string }[] }

// ─── Inline select cell ───────────────────────────────────────────────────────

function SelectCell({
  value, options, onSave, displayFn, colorFn,
}: {
  value: string
  options: string[]
  onSave: (v: string) => void
  displayFn?: (v: string) => string
  colorFn?: (v: string) => string
}) {
  return (
    <select
      value={value}
      onChange={e => { if (e.target.value !== value) onSave(e.target.value) }}
      className={`text-xs font-medium px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#C30017] ${colorFn ? colorFn(value) : 'bg-gray-100 text-gray-700'}`}
    >
      {options.map(o => (
        <option key={o} value={o}>{displayFn ? displayFn(o) : o}</option>
      ))}
    </select>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HREmployees() {
  const [me, setMe] = useState<Me | null>(null)
  const [search, setSearch] = useState('')
  const [buFilter, setBuFilter] = useState('')
  const [importMsg, setImportMsg] = useState<{ text: string; type: 'success'|'warn'|'error' } | null>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const gradesRef  = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ['employees', search, buFilter],
    queryFn: () => api.get(
      `/employees?isActive=true${search ? `&search=${encodeURIComponent(search)}` : ''}${buFilter ? `&buId=${buFilter}` : ''}`
    ).then(r => r.data),
    enabled: !!me,
  })

  const { data: bus } = useQuery<BU[]>({
    queryKey: ['business-units'],
    queryFn: () => api.get('/employees/meta/business-units').then(r => r.data),
    enabled: !!me,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.patch(`/employees/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  const offboardMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['employees'] }),
  })

  function patch(id: string, data: Record<string, unknown>) {
    updateMutation.mutate({ id, data })
  }

  async function handleImport(file: File, type: 'roster' | 'grades') {
    setImportMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const endpoint = type === 'grades' ? '/employees/import-grades' : '/employees/import'
      const r = await api.post(endpoint, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      const d = r.data as Record<string, unknown>
      if (type === 'grades') {
        const unmatched = (d.unmatched as string[]) ?? []
        const text = `Grades imported — ${d.updated} updated, ${d.skipped} skipped${unmatched.length ? `. Unmatched: ${unmatched.slice(0,5).join(', ')}${unmatched.length > 5 ? '…' : ''}` : ''}`
        setImportMsg({ text, type: unmatched.length ? 'warn' : 'success' })
      } else {
        setImportMsg({ text: `Roster imported — ${d.created} added, ${d.updated} updated, ${d.skipped} skipped`, type: 'success' })
      }
      qc.invalidateQueries({ queryKey: ['employees'] })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Import failed'
      setImportMsg({ text: msg, type: 'error' })
    }
  }

  if (!me) return null

  const byBU = employees?.reduce<Record<string, Employee[]>>((acc, emp) => {
    const key = emp.bu?.name ?? 'Unassigned'
    ;(acc[key] ??= []).push(emp)
    return acc
  }, {}) ?? {}

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
            <p className="text-sm text-gray-500 mt-1">
              {employees?.length ?? 0} active staff · click Grade, Team, Office or Role to edit inline
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => gradesRef.current?.click()}>
              ↑ Import Grades
            </Button>
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              ↑ Import Roster
            </Button>
            <input ref={gradesRef} type="file" accept=".xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f, 'grades'); e.target.value = '' }} />
            <input ref={fileRef} type="file" accept=".xlsx,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f, 'roster'); e.target.value = '' }} />
          </div>
        </div>

        {/* Feedback banner */}
        {importMsg && (
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            importMsg.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700'
            : importMsg.type === 'warn' ? 'bg-amber-50 border border-amber-200 text-amber-800'
            : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            {importMsg.text}
            <button onClick={() => setImportMsg(null)} className="ml-4 opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative max-w-xs flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
            </svg>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name, Juru ID…"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"
            />
          </div>
          <select
            value={buFilter} onChange={e => setBuFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"
          >
            <option value="">All BUs</option>
            {bus?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {isLoading && <p className="text-gray-400 text-sm py-4">Loading…</p>}

        {/* Tables grouped by BU */}
        {Object.entries(byBU).sort().map(([buName, emps]) => {
          const buTeams = bus?.find(b => b.name === buName)?.teams ?? []
          return (
            <Card key={buName}>
              <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
                <h3 className="font-semibold text-gray-800">{buName}</h3>
                <span className="text-xs text-gray-400">{emps.length} staff</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-6 py-2 text-left font-medium">Juru ID</th>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Position</th>
                      <th className="px-4 py-2 text-left font-medium">Team</th>
                      <th className="px-4 py-2 text-center font-medium">Grade</th>
                      <th className="px-4 py-2 text-left font-medium">Office</th>
                      <th className="px-4 py-2 text-center font-medium">Role</th>
                      <th className="px-4 py-2 text-center font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emps.map((emp) => (
                      <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                        <td className="px-6 py-2 font-mono text-xs text-gray-400">{emp.juruId ?? '—'}</td>
                        <td className="px-4 py-2 font-medium text-gray-900">{emp.fullName}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs max-w-[180px] truncate" title={emp.position ?? ''}>
                          {emp.position ?? '—'}
                        </td>

                        {/* Team — dropdown of this BU's teams */}
                        <td className="px-4 py-2">
                          {buTeams.length > 0 ? (
                            <select
                              value={emp.team?.name ?? ''}
                              onChange={e => {
                                const t = buTeams.find(t => t.name === e.target.value)
                                if (t) patch(emp.id, { teamId: t.id })
                              }}
                              className="text-xs text-gray-700 bg-transparent border-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#C30017] rounded px-1 py-0.5 hover:bg-gray-100 max-w-[120px]"
                            >
                              <option value="">— no team —</option>
                              {buTeams.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-xs text-gray-400">{emp.team?.name ?? '—'}</span>
                          )}
                        </td>

                        {/* Grade — dropdown */}
                        <td className="px-4 py-2 text-center">
                          <SelectCell
                            value={emp.grade}
                            options={GRADES}
                            onSave={grade => patch(emp.id, { grade })}
                            colorFn={() => 'bg-gray-100 text-gray-700'}
                          />
                        </td>

                        {/* Office — dropdown */}
                        <td className="px-4 py-2">
                          <SelectCell
                            value={emp.office ?? ''}
                            options={['', ...OFFICES]}
                            onSave={office => patch(emp.id, { office })}
                            displayFn={v => v || '—'}
                            colorFn={() => 'bg-transparent text-gray-500'}
                          />
                        </td>

                        {/* Role — dropdown */}
                        <td className="px-4 py-2 text-center">
                          <SelectCell
                            value={emp.role}
                            options={ROLES}
                            onSave={role => patch(emp.id, { role })}
                            displayFn={v => v.replace(/_/g, ' ')}
                            colorFn={v => ROLE_COLOR[v] ?? 'bg-gray-100 text-gray-700'}
                          />
                        </td>

                        <td className="px-4 py-2 text-center">
                          <button
                            onClick={() => { if (confirm(`Offboard ${emp.fullName}?`)) offboardMutation.mutate(emp.id) }}
                            className="text-xs text-red-400 hover:text-red-600 hover:underline"
                          >
                            Offboard
                          </button>
                        </td>
                      </tr>
                    ))}
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
