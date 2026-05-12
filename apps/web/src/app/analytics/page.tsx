'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { performanceBadge } from '@/components/ui/Badge'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ScatterChart, Scatter, ZAxis,
} from 'recharts'

const LABEL_COLORS: Record<string, string> = {
  EXCEPTIONAL:          '#16a34a',
  EXCEEDS_EXPECTATIONS: '#2563eb',
  MEETS_EXPECTATIONS:   '#ca8a04',
  PARTIALLY_MEETS:      '#ea580c',
  BELOW_EXPECTATIONS:   '#dc2626',
}

const SC_LABELS: Record<string, string> = {
  TIMELINE:'Timeline', QUALITY:'Quality', CLIENT_SATISFACTION:'Client Sat.',
  TEAMWORK:'Teamwork', COMMERCIAL_SUCCESS:'Commercial', TECHNICAL_SKILLS:'Technical',
  PEOPLE_SKILLS:'People', CONTINUOUS_LEARNING:'Learning', DISCIPLINE:'Discipline', RELIABILITY:'Reliability',
}

export default function AnalyticsDashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState<string>('')
  const [tab, setTab] = useState<'overview' | 'risk' | 'nominations' | 'heatmap'>('overview')
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })

  useEffect(() => {
    if (cycles?.length && !cycleId) setCycleId(cycles[0].id)
  }, [cycles])

  const { data: dist } = useQuery({
    queryKey: ['dist', cycleId],
    queryFn: () => api.get(`/results/analytics/distribution?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  const { data: results } = useQuery({
    queryKey: ['results', cycleId],
    queryFn: () => api.get(`/results?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  const reportMutation = useMutation({
    mutationFn: () => api.post('/reports/generate', { cycleId }),
  })

  if (!me) return null

  const distData = dist ? Object.entries(dist.distribution).map(([label, count]) => ({
    label: label.replace(/_/g,' '), count, color: LABEL_COLORS[label] ?? '#94a3b8',
  })) : []

  const atRisk   = results?.filter((r: { isAtRisk: boolean })    => r.isAtRisk)    ?? []
  const nominees = results?.filter((r: { isNominated: boolean }) => r.isNominated) ?? []

  // Heatmap: avg sub-criterion score per team
  const teams   = [...new Set(results?.map((r: { employee: { team?: { name: string } } }) => r.employee.team?.name ?? 'Unknown') ?? [])] as string[]
  const criteria = Object.keys(SC_LABELS)

  function avgByCriteria(teamName: string, sc: string): number {
    const teamResults = results?.filter((r: { employee: { team?: { name: string } } }) => (r.employee.team?.name ?? 'Unknown') === teamName) ?? []
    if (!teamResults.length) return 0
    const vals = teamResults.flatMap((r: { subResults: { subCriterion: string; weightedScore: number }[] }) =>
      r.subResults.filter((sr: { subCriterion: string }) => sr.subCriterion === sc).map((sr: { weightedScore: number }) => Number(sr.weightedScore))
    )
    return vals.length ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0
  }

  function heatColor(val: number): string {
    if (val >= 4) return '#dcfce7'
    if (val >= 3) return '#fef9c3'
    if (val >= 2) return '#fed7aa'
    if (val > 0)  return '#fee2e2'
    return '#f9fafb'
  }

  const TABS = [
    { key: 'overview',    label: 'Overview' },
    { key: 'risk',        label: `At-Risk (${atRisk.length})` },
    { key: 'nominations', label: `Nominations (${nominees.length})` },
    { key: 'heatmap',     label: 'Team Heatmap' },
  ]

  return (
    <Shell me={me}>
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-1">Performance distribution, risk register, and nominations</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={cycleId}
              onChange={e => setCycleId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {cycles?.map((c: { id: string; label: string }) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            {['HR_ADMIN','BU_HEAD'].includes(me.role) && (
              <Button size="sm" onClick={() => reportMutation.mutate()} loading={reportMutation.isPending}>
                Generate PDF
              </Button>
            )}
          </div>
        </div>

        {reportMutation.isSuccess && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            PDF report queued. Download it from the <a href="/hr/reports" className="underline">Reports</a> page.
          </div>
        )}

        {/* Summary cards */}
        {dist && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Reviewed', value: results?.length ?? 0 },
              { label: 'Average Score',  value: Number(dist.avgScore).toFixed(2) },
              { label: 'At-Risk',        value: dist.atRiskCount, danger: true },
              { label: 'Nominations',    value: dist.nominatedCount, success: true },
            ].map(stat => (
              <Card key={stat.label}>
                <CardBody className="text-center py-5">
                  <p className={`text-3xl font-bold ${stat.danger ? 'text-red-600' : stat.success ? 'text-green-600' : 'text-gray-900'}`}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as typeof tab)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-[#C30017] text-[#C30017]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Performance Distribution</h2></CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={distData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4,4,0,0]}>
                    {distData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        )}

        {/* At-Risk */}
        {tab === 'risk' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-800">At-Risk Employees</h2>
              <p className="text-xs text-gray-500 mt-0.5">Employees requiring Development Program review</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Employee</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Grade</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Team</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Score</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Below Count</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.map((r: { employee: { fullName: string; grade: string; team?: { name: string } }; overallAvg: number; belowCount: number; performanceLabel: string }, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-6 py-3 font-medium text-gray-900">{r.employee.fullName}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.employee.grade}</td>
                      <td className="px-4 py-3 text-gray-600">{r.employee.team?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-red-600">{Number(r.overallAvg).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center text-red-600 font-semibold">{r.belowCount}</td>
                      <td className="px-4 py-3 text-center">{performanceBadge(r.performanceLabel)}</td>
                    </tr>
                  ))}
                  {atRisk.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400">No at-risk employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Nominations */}
        {tab === 'nominations' && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-800">Nominations</h2>
              <p className="text-xs text-gray-500 mt-0.5">Employees with avg ≥ 4.0, eligible for recognition</p>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-3 text-left font-semibold text-gray-600">Employee</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Grade</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Team</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Score</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Label</th>
                  </tr>
                </thead>
                <tbody>
                  {nominees.map((r: { employee: { fullName: string; grade: string; team?: { name: string } }; overallAvg: number; performanceLabel: string }, i: number) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-6 py-3 font-medium text-gray-900">⭐ {r.employee.fullName}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{r.employee.grade}</td>
                      <td className="px-4 py-3 text-gray-600">{r.employee.team?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{Number(r.overallAvg).toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">{performanceBadge(r.performanceLabel)}</td>
                    </tr>
                  ))}
                  {nominees.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No nominations yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Heatmap */}
        {tab === 'heatmap' && (
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-800">Team × Criterion Heatmap</h2></CardHeader>
            <CardBody>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr>
                      <th className="text-left px-2 py-2 text-gray-500 font-medium">Team</th>
                      {criteria.map(sc => (
                        <th key={sc} className="px-2 py-2 text-center text-gray-500 font-medium">{SC_LABELS[sc]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(team => (
                      <tr key={team}>
                        <td className="px-2 py-2 font-medium text-gray-700 whitespace-nowrap">{team}</td>
                        {criteria.map(sc => {
                          const val = avgByCriteria(team, sc)
                          return (
                            <td
                              key={sc}
                              className="px-2 py-2 text-center rounded"
                              style={{ background: heatColor(val) }}
                              title={`${team} · ${SC_LABELS[sc]} · ${val.toFixed(2)}`}
                            >
                              {val > 0 ? val.toFixed(1) : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </Shell>
  )
}
