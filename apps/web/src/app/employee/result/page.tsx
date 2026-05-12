'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { performanceBadge } from '@/components/ui/Badge'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts'

const SC_LABELS: Record<string, string> = {
  TIMELINE:            'Timeline',
  QUALITY:             'Quality',
  CLIENT_SATISFACTION: 'Client Sat.',
  TEAMWORK:            'Teamwork',
  COMMERCIAL_SUCCESS:  'Commercial',
  TECHNICAL_SKILLS:    'Technical',
  PEOPLE_SKILLS:       'People',
  CONTINUOUS_LEARNING: 'Learning',
  DISCIPLINE:          'Discipline',
  RELIABILITY:         'Reliability',
}

export default function EmployeeResultPage() {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then(r => r.data),
    enabled: !!me,
  })

  const releasedCycle = cycles?.find((c: { resultsReleasedAt: string }) => !!c.resultsReleasedAt)

  const { data: result } = useQuery({
    queryKey: ['my-result', releasedCycle?.id],
    queryFn: () => api.get(`/results/my?cycleId=${releasedCycle.id}`).then(r => r.data),
    enabled: !!releasedCycle,
  })

  if (!me) return null

  const radarData = result?.subResults?.map((sr: { subCriterion: string; weightedScore: number }) => ({
    subject: SC_LABELS[sr.subCriterion] ?? sr.subCriterion,
    score:   Number(sr.weightedScore).toFixed(2),
    fullMark: 5,
  }))

  return (
    <Shell me={me}>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Result</h1>
          {releasedCycle && <p className="text-sm text-gray-500 mt-1">{releasedCycle.label}</p>}
        </div>

        {!releasedCycle && (
          <Card>
            <CardBody className="text-center py-12 text-gray-400">
              <p className="text-lg font-medium">Results not yet released</p>
              <p className="text-sm mt-1">Your manager will release results after the consolidation phase.</p>
            </CardBody>
          </Card>
        )}

        {result && (
          <>
            {/* Score summary */}
            <Card>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-4xl font-bold text-gray-900">{Number(result.overallAvg).toFixed(2)}</p>
                    <p className="text-sm text-gray-500 mt-1">Overall Score (out of 5.00)</p>
                  </div>
                  <div className="text-right space-y-2">
                    {performanceBadge(result.performanceLabel)}
                    {result.isNominated && (
                      <div className="text-sm text-yellow-600 font-medium">★ Nominated</div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Radar chart */}
            <Card>
              <CardHeader><h2 className="font-semibold text-gray-800">Performance by Criterion</h2></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip formatter={(v: number) => v.toFixed(2)} />
                    <Radar dataKey="score" stroke="#C30017" fill="#C30017" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            {/* Sub-criteria table */}
            <Card>
              <CardHeader><h2 className="font-semibold text-gray-800">Detailed Breakdown</h2></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3 text-left font-semibold text-gray-600">Criterion</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600">Evaluator 1 (70%)</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600">Evaluator 2 (30%)</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-600">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.subResults?.map((sr: { subCriterion: string; scoreE1: number; scoreE2: number; weightedScore: number }, i: number) => (
                      <tr key={sr.subCriterion} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-3 font-medium text-gray-900">{SC_LABELS[sr.subCriterion] ?? sr.subCriterion}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{Number(sr.scoreE1).toFixed(1)}</td>
                        <td className="px-4 py-3 text-center text-gray-700">{Number(sr.scoreE2).toFixed(1)}</td>
                        <td className={`px-4 py-3 text-center font-semibold ${Number(sr.weightedScore) < 1.5 ? 'text-red-600' : 'text-gray-900'}`}>
                          {Number(sr.weightedScore).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>
    </Shell>
  )
}
