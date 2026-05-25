'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'

type Feedback = {
  cycleId: string
  interviewNote?: string
  interviewDoneAt?: string
  interviewScheduledAt?: string
  performanceLabel: string
  overallAvg: number
  cycle: { id: string; label: string }
}

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL: 'bg-green-100 text-green-800', EXCEEDS_EXPECTATIONS: 'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS: 'bg-blue-100 text-blue-700', PARTIALLY_MEETS: 'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS: 'bg-red-100 text-red-700',
}
const LABEL_SHORT: Record<string, string> = {
  EXCEPTIONAL: 'Exceptional', EXCEEDS_EXPECTATIONS: 'Exceeds',
  MEETS_EXPECTATIONS: 'Meets', PARTIALLY_MEETS: 'Partially Meets', BELOW_EXPECTATIONS: 'Below',
}

export default function EmployeeInterviewsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: feedback, isLoading } = useQuery<Feedback[]>({
    queryKey: ['my-feedback'],
    queryFn:  () => api.get('/results/my-feedback').then(r => r.data),
    enabled:  !!me,
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Interviews &amp; Feedback</h1>
          <p className="text-sm text-gray-500 mt-1">Interview notes and feedback shared with you after each performance interview</p>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && !feedback?.length && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No interviews yet</p>
            <p className="text-sm mt-1">Interview notes will appear here after your team head completes a performance interview with you.</p>
          </div>
        )}

        <div className="space-y-3">
          {feedback?.map(f => {
            const isOpen = expanded === f.cycleId
            return (
              <Card key={f.cycleId}>
                <button
                  onClick={() => setExpanded(isOpen ? null : f.cycleId)}
                  className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50/60 transition-colors rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-gray-900">{f.cycle.label}</span>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {f.interviewScheduledAt && !f.interviewDoneAt && (
                        <span className="text-xs text-blue-600 font-medium">
                          📅 Scheduled: {new Date(f.interviewScheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                      {f.interviewDoneAt && (
                        <span className="text-xs text-green-600 font-medium">
                          ✓ Completed: {new Date(f.interviewDoneAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LABEL_COLOR[f.performanceLabel]}`}>
                        {Number(f.overallAvg).toFixed(2)} · {LABEL_SHORT[f.performanceLabel]}
                      </span>
                    </div>
                  </div>
                  <svg className={`w-4 h-4 text-gray-300 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-gray-100">
                    {f.interviewNote ? (
                      <div className="mt-4">
                        <p className="text-xs font-medium text-gray-500 mb-2">Feedback from your team head</p>
                        <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border border-gray-100">
                          {f.interviewNote}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-gray-400 italic">
                        {f.interviewDoneAt
                          ? 'Interview completed — no written notes were shared.'
                          : 'Interview not yet completed.'}
                      </p>
                    )}
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
