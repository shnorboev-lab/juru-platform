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
type Score = { subCriterion: string; score: number; note?: string }
type SelfAppraisal = { id: string; status: string; submittedAt?: string; comment?: string; scores: Score[] }
type TeamAppraisal = { employee: Employee; selfAppraisal: SelfAppraisal | null }
type Cycle = { id: string; label: string; phase: string }

const CRITERION_LABEL: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality of Work',
  CLIENT_SATISFACTION: 'Client Satisfaction', TEAMWORK: 'Teamwork',
  COMMERCIAL_SUCCESS: 'Commercial Success', TECHNICAL_SKILLS: 'Technical Skills',
  PEOPLE_SKILLS: 'People Skills', CONTINUOUS_LEARNING: 'Continuous Learning',
  DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

export default function TeamSelfAppraisalsPage() {
  const [me, setMe]       = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [search, setSearch]   = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  useEffect(() => { if (cycles?.length && !cycleId) setCycleId(cycles[0].id) }, [cycles])

  const { data: items, isLoading } = useQuery<TeamAppraisal[]>({
    queryKey: ['team-appraisals', cycleId],
    queryFn:  () => api.get(`/submissions/team-appraisals?cycleId=${cycleId}`).then(r => r.data),
    enabled:  !!cycleId,
  })

  if (!me) return null

  const filtered = (items ?? []).filter(x =>
    !search || x.employee.fullName.toLowerCase().includes(search.toLowerCase()) ||
    (x.employee.juruId ?? '').includes(search)
  )
  const byBU = filtered.reduce<Record<string, TeamAppraisal[]>>((acc, x) => {
    const k = x.employee.bu?.name ?? 'Unassigned'; (acc[k] ??= []).push(x); return acc
  }, {})

  const total     = (items ?? []).length
  const submitted = (items ?? []).filter(x => x.selfAppraisal?.status === 'SUBMITTED').length
  const draft     = (items ?? []).filter(x => x.selfAppraisal?.status === 'DRAFT').length

  return (
    <Shell me={me}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Team Self-Appraisals</h1>
            <p className="text-sm text-gray-500 mt-1">View your team's self-appraisal submissions</p>
          </div>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]">
            {cycles?.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Staff',  value: total,     color: 'text-gray-900' },
            { label: 'Submitted',    value: submitted,  color: 'text-green-600' },
            { label: 'In Draft',     value: draft,      color: 'text-amber-600' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…"
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {Object.entries(byBU).sort().map(([buName, items]) => (
          <Card key={buName}>
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
              <h3 className="font-semibold text-gray-800">{buName}</h3>
              <span className="text-xs text-gray-400">
                {items.filter(x => x.selfAppraisal?.status === 'SUBMITTED').length}/{items.length} submitted
              </span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map(({ employee: emp, selfAppraisal }) => {
                const isOpen = expanded === emp.id
                return (
                  <div key={emp.id}>
                    <button
                      onClick={() => setExpanded(isOpen ? null : emp.id)}
                      className="w-full flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors text-left"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#f5e6e9] text-[#C30017] flex items-center justify-center font-bold text-sm shrink-0">
                        {emp.fullName.split(' ').map(n => n[0]).slice(0,2).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{emp.fullName}</span>
                          {emp.juruId && <span className="text-xs font-mono text-gray-400">{emp.juruId}</span>}
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{emp.grade}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{emp.team?.name ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {selfAppraisal ? (
                          <>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              selfAppraisal.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {selfAppraisal.status === 'SUBMITTED' ? '✓ Submitted' : '… Draft'}
                            </span>
                            {selfAppraisal.submittedAt && (
                              <span className="text-xs text-gray-400">
                                {new Date(selfAppraisal.submittedAt).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300 px-2 py-0.5 rounded-full bg-gray-100">Not started</span>
                        )}
                        <svg className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </button>

                    {isOpen && selfAppraisal?.status === 'SUBMITTED' && (
                      <div className="px-6 pb-5 bg-gray-50/40 border-t border-gray-100">
                        {selfAppraisal.comment && (
                          <p className="text-sm text-gray-600 italic mt-3 mb-4 bg-white rounded-lg p-3 border border-gray-100">"{selfAppraisal.comment}"</p>
                        )}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          {selfAppraisal.scores.map(s => (
                            <div key={s.subCriterion} className="bg-white rounded-lg border border-gray-100 p-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-500">{CRITERION_LABEL[s.subCriterion] ?? s.subCriterion}</span>
                                <span className="text-sm font-bold text-gray-800">{s.score}/5</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#C30017] rounded-full" style={{ width: `${(s.score / 5) * 100}%` }} />
                              </div>
                              {s.note && <p className="text-xs text-gray-400 mt-1 truncate">{s.note}</p>}
                            </div>
                          ))}
                        </div>
                        <Link href={`/interviews/${emp.id}?cycleId=${cycleId}`}
                          className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#C30017] font-medium hover:underline">
                          Open interview view →
                        </Link>
                      </div>
                    )}
                    {isOpen && !selfAppraisal?.status && (
                      <div className="px-6 py-4 bg-gray-50/40 border-t border-gray-100 text-sm text-gray-400">
                        No self-appraisal submitted yet.
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
