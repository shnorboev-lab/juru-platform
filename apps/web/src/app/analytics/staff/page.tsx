'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

type SubmissionStatus = { self?: string; eval1?: string; eval2?: string }
type StaffRow = {
  id: string; juruId?: string; fullName: string; position?: string; grade: string; office?: string
  team?: { name: string }; bu?: { name: string }
  submissions: SubmissionStatus
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-gray-300">—</span>
  const colors: Record<string, string> = {
    SUBMITTED: 'bg-green-100 text-green-700',
    DRAFT:     'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {status === 'SUBMITTED' ? '✓ Done' : 'Draft'}
    </span>
  )
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-[#C30017] h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500 shrink-0">{done}/{total}</span>
    </div>
  )
}

export default function StaffProgressPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [filterTeam, setFilterTeam] = useState('')
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then(r => r.data),
    enabled: !!me,
  })

  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const { data: staff } = useQuery<StaffRow[]>({
    queryKey: ['bu-progress', cycleId],
    queryFn: () => api.get(`/employees/bu-progress/${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  if (!me) return null

  const teams = [...new Set(staff?.map(s => s.team?.name ?? 'Unassigned') ?? [])].sort()
  const filtered = filterTeam ? staff?.filter(s => (s.team?.name ?? 'Unassigned') === filterTeam) : staff

  const selfDone  = filtered?.filter(s => s.submissions.self  === 'SUBMITTED').length ?? 0
  const eval1Done = filtered?.filter(s => s.submissions.eval1 === 'SUBMITTED').length ?? 0
  const eval2Done = filtered?.filter(s => s.submissions.eval2 === 'SUBMITTED').length ?? 0
  const total     = filtered?.length ?? 0

  // Group by team
  const byTeam = (filtered ?? []).reduce<Record<string, StaffRow[]>>((acc, s) => {
    const key = s.team?.name ?? 'Unassigned'
    ;(acc[key] ??= []).push(s)
    return acc
  }, {})

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Staff Progress</h1>
            <p className="text-sm text-gray-500 mt-1">Track self-appraisal and evaluation completion across your team</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            {/* Cycle selector */}
            <select
              value={cycleId}
              onChange={e => setCycleId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"
            >
              {cycles?.map((c: { id: string; label: string }) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {/* Team filter */}
            <select
              value={filterTeam}
              onChange={e => setFilterTeam(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]"
            >
              <option value="">All teams</option>
              {teams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Self-appraisals', done: selfDone,  total, color: 'text-blue-600' },
            { label: 'Evaluations (E1)', done: eval1Done, total, color: 'text-purple-600' },
            { label: 'Evaluations (E2)', done: eval2Done, total, color: 'text-indigo-600' },
          ].map(({ label, done, color }) => (
            <Card key={label}>
              <div className="p-5">
                <p className="text-sm text-gray-500 mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{done}<span className="text-sm text-gray-400 font-normal">/{total}</span></p>
                <Progress done={done} total={total} />
              </div>
            </Card>
          ))}
        </div>

        {/* Table grouped by team */}
        {Object.entries(byTeam).sort().map(([team, rows]) => (
          <Card key={team}>
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800">{team}</h3>
              <div className="flex items-center gap-6 text-xs text-gray-500">
                <span>Self: {rows.filter(r => r.submissions.self === 'SUBMITTED').length}/{rows.length}</span>
                <span>E1: {rows.filter(r => r.submissions.eval1 === 'SUBMITTED').length}/{rows.length}</span>
                <span>E2: {rows.filter(r => r.submissions.eval2 === 'SUBMITTED').length}/{rows.length}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-6 py-2 text-left">Juru ID</th>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Position</th>
                    <th className="px-4 py-2 text-center">Grade</th>
                    <th className="px-4 py-2 text-center">Self-Appraisal</th>
                    <th className="px-4 py-2 text-center">Eval 1 (70%)</th>
                    <th className="px-4 py-2 text-center">Eval 2 (30%)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((emp, i) => {
                    const allDone = emp.submissions.self === 'SUBMITTED' &&
                                   emp.submissions.eval1 === 'SUBMITTED' &&
                                   emp.submissions.eval2 === 'SUBMITTED'
                    return (
                      <tr key={emp.id}
                        className={`border-b border-gray-50 hover:bg-[#fdf3f4] transition-colors cursor-pointer ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                        <td className="px-6 py-3 font-mono text-xs text-gray-400">{emp.juruId ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Link href={`/interviews/${emp.id}?cycleId=${cycleId}`} className="flex items-center gap-2 group">
                            <span className="font-medium text-gray-900 group-hover:text-[#C30017]">{emp.fullName}</span>
                            {allDone && <span className="text-xs text-green-600">✓</span>}
                            <svg className="w-3 h-3 text-gray-300 group-hover:text-[#C30017] ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate">{emp.position ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{emp.grade}</span>
                        </td>
                        <td className="px-4 py-3 text-center"><StatusPill status={emp.submissions.self} /></td>
                        <td className="px-4 py-3 text-center"><StatusPill status={emp.submissions.eval1} /></td>
                        <td className="px-4 py-3 text-center"><StatusPill status={emp.submissions.eval2} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

        {!staff?.length && cycleId && (
          <div className="text-center py-16 text-gray-400 text-sm">No employees found for this cycle.</div>
        )}
      </div>
    </Shell>
  )
}
