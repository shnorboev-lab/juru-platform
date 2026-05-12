'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { format } from 'date-fns'

export default function ReportsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [cycleId, setCycleId] = useState('')
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'], queryFn: () => api.get('/cycles').then(r => r.data), enabled: !!me,
  })
  const { data: reports, refetch } = useQuery({
    queryKey: ['reports', cycleId],
    queryFn: () => api.get(`/reports?cycleId=${cycleId}`).then(r => r.data),
    enabled: !!cycleId,
  })

  const genMutation = useMutation({
    mutationFn: () => api.post('/reports/generate', { cycleId }),
    onSuccess: () => setTimeout(refetch, 3000),
  })

  if (!me) return null

  return (
    <Shell me={me}>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Generate and download PDF performance reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={cycleId}
              onChange={e => setCycleId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Select cycle…</option>
              {cycles?.map((c: { id: string; label: string }) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <Button
              onClick={() => genMutation.mutate()}
              loading={genMutation.isPending}
              disabled={!cycleId}
            >
              Generate Report
            </Button>
          </div>
        </div>

        {genMutation.isSuccess && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
            Report queued. It will appear below in a few seconds.
          </div>
        )}

        <Card>
          <CardHeader><h2 className="font-semibold text-gray-800">Available Reports</h2></CardHeader>
          <div className="divide-y divide-gray-100">
            {reports?.length === 0 && (
              <div className="px-6 py-10 text-center text-gray-400 text-sm">No reports generated yet</div>
            )}
            {reports?.map((r: { id: string; label: string; fileUrl?: string; createdAt: string }) => (
              <div key={r.id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="font-medium text-gray-900">{r.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generated {format(new Date(r.createdAt), 'dd MMM yyyy HH:mm')}
                  </p>
                </div>
                {r.fileUrl ? (
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}${r.fileUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#C30017] font-medium hover:underline"
                  >
                    Download PDF
                  </a>
                ) : (
                  <span className="text-xs text-gray-400">Generating…</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  )
}
