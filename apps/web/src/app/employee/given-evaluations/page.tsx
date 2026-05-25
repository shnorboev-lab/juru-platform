'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'

type Score = { subCriterion: string; score: number; note?: string }
type Employee = { id: string; fullName: string; grade: string; juruId?: string; team?: { name: string } }
type Cycle = { id: string; label: string; type: string; year: number; phase: string }
type EvalSub = {
  id: string; type: string; status: string; submittedAt?: string; comment?: string
  scores: Score[]; employee: Employee; cycle: Cycle
}
type PendingAssignment = {
  id: string; cycleId: string; evalType: 'EVAL_1' | 'EVAL_2'; submissionStatus: string | null
  employee: Employee; cycle: Cycle & { evaluationEnd: string }
}

const CRITERION_LABEL: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality of Work', CLIENT_SATISFACTION: 'Client Satisfaction',
  TEAMWORK: 'Teamwork', COMMERCIAL_SUCCESS: 'Commercial Success', TECHNICAL_SKILLS: 'Technical Skills',
  PEOPLE_SKILLS: 'People Skills', CONTINUOUS_LEARNING: 'Continuous Learning',
  DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

const SCORE_COLOR = (s: number) =>
  s >= 4 ? 'text-green-700 bg-green-50' : s >= 3 ? 'text-blue-700 bg-blue-50' : s >= 2 ? 'text-amber-700 bg-amber-50' : 'text-red-700 bg-red-50'

const EDITABLE_PHASES = new Set(['EVALUATION', 'CONSOLIDATION'])

export default function GivenEvaluationsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: submitted, isLoading: loadingSubs } = useQuery<EvalSub[]>({
    queryKey: ['as-evaluator'],
    queryFn:  () => api.get('/submissions/as-evaluator').then(r => r.data),
    enabled:  !!me,
  })
  const { data: pending, isLoading: loadingPending } = useQuery<PendingAssignment[]>({
    queryKey: ['my-eval-assignments'],
    queryFn:  () => api.get('/submissions/my-eval-assignments').then(r => r.data),
    enabled:  !!me,
  })

  if (!me) return null

  // Group submitted by cycle
  const byCycle = (submitted ?? []).reduce<Record<string, { cycle: Cycle; subs: EvalSub[] }>>((acc, s) => {
    if (!acc[s.cycle.id]) acc[s.cycle.id] = { cycle: s.cycle, subs: [] }
    acc[s.cycle.id].subs.push(s)
    return acc
  }, {})

  const pendingNotSubmitted = (pending ?? []).filter(a => a.submissionStatus !== 'SUBMITTED')

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evaluations Given</h1>
          <p className="text-sm text-gray-500 mt-1">Evaluations you've submitted for colleagues — read-only after the cycle closes</p>
        </div>

        {/* Pending active evaluations */}
        {pendingNotSubmitted.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pending — Action Required</h2>
            <div className="space-y-2">
              {pendingNotSubmitted.map(a => (
                <div key={`${a.cycleId}-${a.employee.id}`}
                  className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{a.employee.fullName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {a.cycle.label} · Evaluator {a.evalType === 'EVAL_1' ? '1 (70%)' : '2 (30%)'} · Due {new Date(a.cycle.evaluationEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    a.submissionStatus === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {a.submissionStatus === 'DRAFT' ? '… Draft saved' : 'Not started'}
                  </span>
                  <Link href="/evaluator"
                    className="text-xs px-3 py-1.5 bg-[#C30017] text-white rounded-lg hover:bg-[#a30014] font-medium shrink-0">
                    {a.submissionStatus === 'DRAFT' ? 'Continue' : 'Start'}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Past evaluations by cycle */}
        {loadingSubs && <p className="text-sm text-gray-400">Loading…</p>}

        {!loadingSubs && Object.keys(byCycle).length === 0 && pendingNotSubmitted.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No evaluations yet</p>
            <p className="text-sm mt-1">You haven't been assigned to evaluate anyone yet.</p>
          </div>
        )}

        {Object.values(byCycle)
          .sort((a, b) => b.cycle.year - a.cycle.year)
          .map(({ cycle, subs }) => {
            const locked = !EDITABLE_PHASES.has(cycle.phase)
            return (
              <div key={cycle.id}>
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-gray-700">{cycle.label}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${locked ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                    {locked ? '🔒 Closed' : '● Open'}
                  </span>
                </div>
                <div className="space-y-2">
                  {subs.map(sub => {
                    const key  = `${cycle.id}-${sub.id}`
                    const isOpen = expanded === key
                    const avg  = sub.scores.length ? (sub.scores.reduce((s, sc) => s + sc.score, 0) / sub.scores.length).toFixed(1) : null
                    return (
                      <Card key={sub.id}>
                        <button onClick={() => setExpanded(isOpen ? null : key)}
                          className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/60 transition-colors rounded-xl">
                          <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-sm shrink-0">
                            {sub.employee.fullName.split(' ').map(n => n[0]).slice(0,2).join('')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{sub.employee.fullName}</span>
                              <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{sub.employee.grade}</span>
                              {sub.employee.juruId && <span className="text-xs text-gray-400 font-mono">{sub.employee.juruId}</span>}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {sub.type === 'EVAL_1' ? 'Evaluator 1 (70%)' : 'Evaluator 2 (30%)'}
                              {sub.submittedAt && ` · Submitted ${new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            {avg && <span className="text-lg font-bold text-gray-800">{avg}<span className="text-xs text-gray-400">/5</span></span>}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              sub.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {sub.status === 'SUBMITTED' ? '✓ Submitted' : '… Draft'}
                            </span>
                            {!locked && sub.status !== 'SUBMITTED' && (
                              <Link href="/evaluator" onClick={e => e.stopPropagation()}
                                className="text-xs px-2 py-1 bg-[#C30017] text-white rounded-lg hover:bg-[#a30014]">
                                Edit
                              </Link>
                            )}
                            <svg className={`w-4 h-4 text-gray-300 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                            </svg>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-5 border-t border-gray-100">
                            {sub.comment && (
                              <p className="text-sm text-gray-600 italic mt-4 bg-gray-50 rounded-lg p-3">"{sub.comment}"</p>
                            )}
                            <div className="mt-4 grid grid-cols-2 gap-2">
                              {sub.scores.map(s => (
                                <div key={s.subCriterion} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                                  <span className="text-xs text-gray-600">{CRITERION_LABEL[s.subCriterion] ?? s.subCriterion}</span>
                                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${SCORE_COLOR(s.score)}`}>{s.score}/5</span>
                                </div>
                              ))}
                            </div>
                            {locked && (
                              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                                🔒 This cycle is closed — scores cannot be changed.
                              </p>
                            )}
                          </div>
                        )}
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
      </div>
    </Shell>
  )
}
