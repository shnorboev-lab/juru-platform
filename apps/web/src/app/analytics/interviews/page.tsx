'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { performanceBadge } from '@/components/ui/Badge'

export default function InterviewsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  const [noteFor, setNoteFor] = useState<{ cycleId: string; employeeId: string } | null>(null)
  const [note, setNote] = useState('')
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  const { data: results } = useQuery({
    queryKey: ['results', cycleId],
    queryFn: () => api.get(`/results?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  useEffect(() => {
    if (cycles?.length && !cycleId) setCycleId(cycles[0].id)
  }, [cycles])

  const interviewMutation = useMutation({
    mutationFn: ({ cycleId, employeeId, done }: { cycleId: string; employeeId: string; done: boolean }) =>
      api.patch(`/results/${cycleId}/${employeeId}/interview`, { note, done }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['results', cycleId] }); setNoteFor(null); setNote('') },
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Performance Interviews</h1>
            <p className="text-sm text-gray-500 mt-1">Log interview notes and mark completion</p>
          </div>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {cycles?.map((c: { id: string; label: string }) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-6 py-3 text-left font-semibold text-gray-600">Employee</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Grade</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Score</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Label</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Interview Note</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {results?.map((r: { employee: { id: string; fullName: string; grade: string }; overallAvg: number; performanceLabel: string; interviewNote?: string; interviewDoneAt?: string }, i: number) => (
                  <tr key={r.employee.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-3 font-medium text-gray-900">{r.employee.fullName}</td>
                    <td className="px-4 py-3 text-center text-gray-600">{r.employee.grade}</td>
                    <td className="px-4 py-3 text-center font-semibold text-gray-800">{Number(r.overallAvg).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">{performanceBadge(r.performanceLabel)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{r.interviewNote ?? '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {r.interviewDoneAt
                        ? <span className="text-xs text-green-700 font-medium">✓ Done</span>
                        : <span className="text-xs text-gray-400">Pending</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {!r.interviewDoneAt && (
                        <button
                          onClick={() => { setNoteFor({ cycleId, employeeId: r.employee.id }); setNote(r.interviewNote ?? '') }}
                          className="text-xs text-[#C30017] hover:underline"
                        >
                          Log Note
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Note modal */}
        {noteFor && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <h3 className="font-bold text-gray-900 text-lg mb-3">Interview Note</h3>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={5}
                placeholder="Enter interview observations, feedback, and action items…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => interviewMutation.mutate({ ...noteFor, done: false })}
                  variant="secondary"
                  loading={interviewMutation.isPending}
                >
                  Save Note
                </Button>
                <Button
                  onClick={() => interviewMutation.mutate({ ...noteFor, done: true })}
                  loading={interviewMutation.isPending}
                >
                  Mark Complete
                </Button>
                <Button variant="ghost" onClick={() => setNoteFor(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  )
}
