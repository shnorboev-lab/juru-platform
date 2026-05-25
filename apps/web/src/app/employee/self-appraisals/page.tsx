'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'

type Score = { subCriterion: string; score: number; note?: string }
type Cycle = { id: string; label: string; type: string; year: number; phase: string }
type Submission = {
  id: string; status: string; submittedAt?: string; comment?: string
  scores: Score[]; cycle: Cycle
}

const CRITERION_LABEL: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality of Work',
  CLIENT_SATISFACTION: 'Client Satisfaction', TEAMWORK: 'Teamwork',
  COMMERCIAL_SUCCESS: 'Commercial Success', TECHNICAL_SKILLS: 'Technical Skills',
  PEOPLE_SKILLS: 'People Skills', CONTINUOUS_LEARNING: 'Continuous Learning',
  DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 4 ? 'bg-green-500' : score >= 3 ? 'bg-blue-500' : score >= 2 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${(score / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-4">{score}</span>
    </div>
  )
}

export default function EmployeeSelfAppraisalsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: submissions, isLoading } = useQuery<Submission[]>({
    queryKey: ['my-self-appraisals'],
    queryFn:  () => api.get('/submissions/my').then(r => r.data),
    enabled:  !!me,
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Self-Appraisals</h1>
          <p className="text-sm text-gray-500 mt-1">Your submitted self-appraisals across all review cycles</p>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && !submissions?.length && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No self-appraisals yet</p>
            <p className="text-sm mt-1">You'll see your submissions here once a review cycle opens.</p>
          </div>
        )}

        <div className="space-y-3">
          {submissions?.map(sub => {
            const isOpen = expanded === sub.id
            const avg    = sub.scores.length ? (sub.scores.reduce((s, sc) => s + sc.score, 0) / sub.scores.length).toFixed(1) : null
            return (
              <Card key={sub.id}>
                <button
                  onClick={() => setExpanded(isOpen ? null : sub.id)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/60 transition-colors rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{sub.cycle.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        sub.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {sub.status === 'SUBMITTED' ? '✓ Submitted' : '… Draft'}
                      </span>
                    </div>
                    {sub.submittedAt && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        Submitted {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {avg && (
                    <div className="text-center shrink-0">
                      <p className="text-xs text-gray-400 mb-0.5">Avg score</p>
                      <p className="text-xl font-bold text-gray-800">{avg}<span className="text-sm text-gray-400">/5</span></p>
                    </div>
                  )}
                  <svg className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    {sub.comment && (
                      <p className="text-sm text-gray-600 italic mt-4 bg-gray-50 rounded-lg p-3">"{sub.comment}"</p>
                    )}
                    <div className="mt-4 space-y-3">
                      {sub.scores.map(s => (
                        <div key={s.subCriterion} className="flex items-center gap-4">
                          <span className="text-xs text-gray-600 w-40 shrink-0">{CRITERION_LABEL[s.subCriterion] ?? s.subCriterion}</span>
                          <div className="flex-1">
                            <ScoreBar score={s.score} />
                            {s.note && <p className="text-xs text-gray-400 mt-0.5">{s.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
