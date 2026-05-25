'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

type SubResult = { subCriterion: string; scoreE1: number; scoreE2: number; weightedScore: number }
type Result = {
  employeeId: string; overallAvg: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean; belowCount: number
  interviewDoneAt?: string
  subResults: SubResult[]
  employee: { fullName: string; grade: string; team?: { name: string }; bu?: { name: string } }
}
type Cycle = { id: string; label: string; phase: string }

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL:          'bg-green-100 text-green-800',
  EXCEEDS_EXPECTATIONS: 'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS:   'bg-blue-100 text-blue-700',
  PARTIALLY_MEETS:      'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS:   'bg-red-100 text-red-700',
}
const LABEL_SHORT: Record<string, string> = {
  EXCEPTIONAL: 'Exceptional', EXCEEDS_EXPECTATIONS: 'Exceeds',
  MEETS_EXPECTATIONS: 'Meets', PARTIALLY_MEETS: 'Partially Meets', BELOW_EXPECTATIONS: 'Below',
}
const CRITERION_LABEL: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality', CLIENT_SATISFACTION: 'Client Satisfaction',
  TEAMWORK: 'Teamwork', COMMERCIAL_SUCCESS: 'Commercial', TECHNICAL_SKILLS: 'Technical Skills',
  PEOPLE_SKILLS: 'People Skills', CONTINUOUS_LEARNING: 'Learning', DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

export default function TeamEvaluationsPage() {
  const [me, setMe]           = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const teamId = me?.teamId ?? me?.team?.id
  const { data: results, isLoading } = useQuery<Result[]>({
    queryKey: ['team-results', cycleId, teamId],
    queryFn: () => api.get(`/results?cycleId=${cycleId}${teamId ? `&teamId=${teamId}` : ''}`).then(r => r.data),
    enabled: !!cycleId,
  })

  if (!me) return null

  const filtered = (results ?? []).filter(r =>
    !search || r.employee.fullName.toLowerCase().includes(search.toLowerCase())
  )

  const byBU = filtered.reduce<Record<string, Result[]>>((acc, r) => {
    const k = (r.employee as any).bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(r); return acc
  }, {})

  const totalResults  = results?.length ?? 0
  const atRiskCount   = results?.filter(r => r.isAtRisk).length ?? 0
  const nominatedCount = results?.filter(r => r.isNominated).length ?? 0
  const avgScore      = totalResults > 0 ? (results!.reduce((s, r) => s + Number(r.overallAvg), 0) / totalResults).toFixed(2) : '—'

  return (
    <Shell me={me}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Evaluation Results</h1>
            <p className="text-sm text-gray-500 mt-1">Consolidated performance scores for your team</p>
          </div>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Scores Available', value: totalResults,    color: 'text-gray-900' },
            { label: 'Team Avg Score',   value: avgScore,         color: 'text-blue-600' },
            { label: 'At Risk',          value: atRiskCount,      color: 'text-red-600'  },
            { label: 'Nominated',        value: nominatedCount,   color: 'text-green-600'},
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading results…</p>}

        {!isLoading && totalResults === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm mt-1">Consolidated scores will appear here once evaluations are complete.</p>
          </div>
        )}

        {Object.entries(byBU).sort().map(([buName, items]) => (
          <Card key={buName}>
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/80">
              <h3 className="font-semibold text-gray-800">{buName}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map(result => {
                const isOpen = expanded === result.employeeId
                const emp    = result.employee as any
                return (
                  <div key={result.employeeId}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : result.employeeId)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#f5e6e9] text-[#C30017] flex items-center justify-center font-bold text-sm shrink-0">
                        {result.employee.fullName.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{result.employee.fullName}</span>
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{result.employee.grade}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{result.employee.team?.name ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLOR[result.performanceLabel]}`}>
                          {Number(result.overallAvg).toFixed(2)} · {LABEL_SHORT[result.performanceLabel]}
                        </span>
                        {result.isAtRisk    && <span className="text-xs text-red-500 font-medium">⚠ At Risk</span>}
                        {result.isNominated && <span className="text-xs text-green-500 font-medium">★ Nominated</span>}
                        <svg className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="px-6 pb-5 bg-gray-50/40 border-t border-gray-100">
                        <div className="mt-4 overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-400 uppercase tracking-wide">
                                <th className="text-left pb-2 font-medium">Criterion</th>
                                <th className="text-center pb-2 font-medium">E1</th>
                                <th className="text-center pb-2 font-medium">E2</th>
                                <th className="text-center pb-2 font-medium">Weighted</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {result.subResults.map(sr => (
                                <tr key={sr.subCriterion}>
                                  <td className="py-1.5 text-gray-600">{CRITERION_LABEL[sr.subCriterion] ?? sr.subCriterion}</td>
                                  <td className="py-1.5 text-center text-gray-700 font-medium">{Number(sr.scoreE1).toFixed(2)}</td>
                                  <td className="py-1.5 text-center text-gray-700 font-medium">{Number(sr.scoreE2).toFixed(2)}</td>
                                  <td className="py-1.5 text-center font-bold text-gray-900">{Number(sr.weightedScore).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t border-gray-200">
                                <td className="pt-2 text-gray-500 font-medium">Overall</td>
                                <td />
                                <td />
                                <td className="pt-2 text-center font-bold text-gray-900">{Number(result.overallAvg).toFixed(2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                        <Link href={`/interviews/${result.employeeId}?cycleId=${cycleId}`}
                          className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#C30017] font-medium hover:underline">
                          Open interview view →
                        </Link>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  )
}
