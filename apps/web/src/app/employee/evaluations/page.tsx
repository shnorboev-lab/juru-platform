'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'

type SubResult = { subCriterion: string; scoreE1: number; scoreE2: number; weightedScore: number }
type Cycle = { id: string; label: string; type: string; year: number; phase: string }
type Result = {
  cycleId: string; overallAvg: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean; belowCount: number
  cycle: Cycle; subResults: SubResult[]
}

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL: 'bg-green-100 text-green-800', EXCEEDS_EXPECTATIONS: 'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS: 'bg-blue-100 text-blue-700', PARTIALLY_MEETS: 'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS: 'bg-red-100 text-red-700',
}
const LABEL_FULL: Record<string, string> = {
  EXCEPTIONAL: 'Exceptional', EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
  MEETS_EXPECTATIONS: 'Meets Expectations', PARTIALLY_MEETS: 'Partially Meets Expectations',
  BELOW_EXPECTATIONS: 'Below Expectations',
}
const CRITERION_LABEL: Record<string, string> = {
  TIMELINE: 'Timeline', QUALITY: 'Quality of Work', CLIENT_SATISFACTION: 'Client Satisfaction',
  TEAMWORK: 'Teamwork', COMMERCIAL_SUCCESS: 'Commercial Success', TECHNICAL_SKILLS: 'Technical Skills',
  PEOPLE_SKILLS: 'People Skills', CONTINUOUS_LEARNING: 'Continuous Learning',
  DISCIPLINE: 'Discipline', RELIABILITY: 'Reliability',
}

export default function EmployeeEvaluationsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: results, isLoading } = useQuery<Result[]>({
    queryKey: ['my-results-history'],
    queryFn:  () => api.get('/results/my-history').then(r => r.data),
    enabled:  !!me,
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Evaluations</h1>
          <p className="text-sm text-gray-500 mt-1">Your consolidated performance results across all review cycles</p>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && !results?.length && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No results yet</p>
            <p className="text-sm mt-1">Your evaluation results will appear here once released by HR.</p>
          </div>
        )}

        <div className="space-y-3">
          {results?.map(result => {
            const isOpen = expanded === result.cycleId
            return (
              <Card key={result.cycleId}>
                <button
                  onClick={() => setExpanded(isOpen ? null : result.cycleId)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/60 transition-colors rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{result.cycle.label}</span>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_COLOR[result.performanceLabel]}`}>
                        {LABEL_FULL[result.performanceLabel]}
                      </span>
                      {result.isAtRisk    && <span className="text-xs text-red-500 font-medium">⚠ At Risk</span>}
                      {result.isNominated && <span className="text-xs text-green-600 font-medium">★ Nominated</span>}
                    </div>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-xs text-gray-400 mb-0.5">Overall</p>
                    <p className="text-2xl font-bold text-gray-900">{Number(result.overallAvg).toFixed(2)}</p>
                  </div>
                  <svg className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-400 uppercase tracking-wide">
                            <th className="text-left pb-2 font-medium">Criterion</th>
                            <th className="text-center pb-2 font-medium">E1 (70%)</th>
                            <th className="text-center pb-2 font-medium">E2 (30%)</th>
                            <th className="text-center pb-2 font-medium">Weighted</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {result.subResults.map(sr => (
                            <tr key={sr.subCriterion}>
                              <td className="py-2 text-gray-700">{CRITERION_LABEL[sr.subCriterion] ?? sr.subCriterion}</td>
                              <td className="py-2 text-center text-gray-600">{Number(sr.scoreE1).toFixed(2)}</td>
                              <td className="py-2 text-center text-gray-600">{Number(sr.scoreE2).toFixed(2)}</td>
                              <td className="py-2 text-center font-bold text-gray-900">{Number(sr.weightedScore).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200">
                            <td className="pt-2 font-bold text-gray-700">Overall Average</td>
                            <td /><td />
                            <td className="pt-2 text-center font-bold text-lg text-gray-900">{Number(result.overallAvg).toFixed(2)}</td>
                          </tr>
                        </tfoot>
                      </table>
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
