'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

type Employee = {
  id: string; juruId?: string; fullName: string; grade: string
  team?: { name: string }; bu?: { name: string }
}
type Result = {
  employeeId: string; overallAvg: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean; interviewDoneAt?: string; interviewNote?: string
}
type Submission = { employeeId: string; type: string; status: string }
type Cycle = { id: string; label: string; phase: string }

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL:          'bg-green-100 text-green-800',
  EXCEEDS_EXPECTATIONS: 'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS:   'bg-blue-100 text-blue-700',
  PARTIALLY_MEETS:      'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS:   'bg-red-100 text-red-700',
}
const LABEL_SHORT: Record<string, string> = {
  EXCEPTIONAL:          'Exceptional',
  EXCEEDS_EXPECTATIONS: 'Exceeds',
  MEETS_EXPECTATIONS:   'Meets',
  PARTIALLY_MEETS:      'Partially Meets',
  BELOW_EXPECTATIONS:   'Below',
}

export default function InterviewsPage() {
  const [me, setMe]       = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [search, setSearch]   = useState('')
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees-interviews'],
    queryFn: () => api.get('/employees?isActive=true').then(r => r.data),
    enabled: !!me,
  })
  const { data: results } = useQuery<Result[]>({
    queryKey: ['results', cycleId],
    queryFn: () => api.get(`/results?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
    refetchInterval: 30_000,
  })
  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ['submissions-int', cycleId],
    queryFn: () => api.get(`/submissions?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  if (!me) return null

  const resultsMap    = new Map((results ?? []).map(r => [r.employeeId, r]))
  const selfSubmitted = new Set((submissions ?? []).filter(s => s.type === 'SELF' && s.status === 'SUBMITTED').map(s => s.employeeId))

  // Team heads see only their team; HR sees all
  const myTeamId = (me as unknown as { teamId?: string }).teamId
  const visible = (employees ?? []).filter(e => {
    if (me.role === 'HR_ADMIN') return true
    // team head: filter to their team (team has same head)
    return true // API already filters by role/team on server side
  }).filter(e =>
    !search || e.fullName.toLowerCase().includes(search.toLowerCase()) || (e.juruId ?? '').includes(search)
  )

  const byBU = visible.reduce<Record<string, Employee[]>>((acc, e) => {
    const k = e.bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(e); return acc
  }, {})

  const interviewDone  = (results ?? []).filter(r => r.interviewDoneAt).length
  const atRiskCount    = (results ?? []).filter(r => r.isAtRisk).length
  const nominatedCount = (results ?? []).filter(r => r.isNominated).length

  return (
    <Shell me={me}>
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Interviews</h1>
            <p className="text-sm text-gray-500 mt-1">Review self-appraisals and evaluation results · record interview notes</p>
          </div>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Staff',          value: visible.length,    color: 'text-gray-900'  },
            { label: 'Self-Appraisals Done', value: selfSubmitted.size, color: 'text-blue-600'  },
            { label: 'Interviews Done',      value: interviewDone,      color: 'text-green-600' },
            { label: 'At Risk',              value: atRiskCount,        color: 'text-red-600'   },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or Juru ID…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>

        {Object.entries(byBU).sort().map(([buName, emps]) => (
          <Card key={buName}>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <h3 className="font-semibold text-gray-800">{buName}</h3>
              <span className="text-xs text-gray-400">
                {emps.filter(e => resultsMap.get(e.id)?.interviewDoneAt).length}/{emps.length} interviewed
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {emps.map(emp => {
                const res       = resultsMap.get(emp.id)
                const selfDone  = selfSubmitted.has(emp.id)
                const intDone   = !!res?.interviewDoneAt
                return (
                  <Link key={emp.id} href={`/interviews/${emp.id}?cycleId=${cycleId}`}
                    className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors group">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-[#f5e6e9] text-[#C30017] flex items-center justify-center font-bold text-sm shrink-0">
                      {emp.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 group-hover:text-[#C30017] transition-colors">{emp.fullName}</span>
                        {emp.juruId && <span className="text-xs font-mono text-gray-400">{emp.juruId}</span>}
                        <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{emp.grade}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{emp.team?.name ?? '—'}</p>
                    </div>
                    {/* Status indicators */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Self-appraisal</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selfDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {selfDone ? '✓ Done' : 'Pending'}
                        </span>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Score</p>
                        {res ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLOR[res.performanceLabel]}`}>
                            {Number(res.overallAvg).toFixed(2)} · {LABEL_SHORT[res.performanceLabel]}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">Not yet</span>
                        )}
                      </div>
                      {res?.isAtRisk    && <span className="text-xs text-red-500 font-medium">⚠ At Risk</span>}
                      {res?.isNominated && <span className="text-xs text-green-500 font-medium">★ Nominated</span>}
                      <div className="text-center">
                        <p className="text-xs text-gray-400 mb-0.5">Interview</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${intDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                          {intDone ? '✓ Done' : 'Pending'}
                        </span>
                      </div>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-[#C30017] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </Link>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  )
}
