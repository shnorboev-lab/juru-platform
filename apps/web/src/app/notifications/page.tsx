'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardBody } from '@/components/ui/Card'
import { format } from 'date-fns'
import { Bell, CheckCircle, AlertTriangle, Mail } from 'lucide-react'

function notifIcon(event: string) {
  if (event.includes('RISK'))       return <AlertTriangle size={16} className="text-red-500" />
  if (event.includes('REMINDER'))   return <Bell size={16} className="text-orange-500" />
  if (event.includes('RESULT'))     return <CheckCircle size={16} className="text-green-500" />
  return <Mail size={16} className="text-blue-500" />
}

export default function NotificationsPage() {
  const [me, setMe] = useState<Me | null>(null)
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/my').then(r => r.data),
    enabled: !!me,
    refetchInterval: 30_000,
  })

  const readMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  if (!me) return null

  const pending = notifications?.filter((n: { status: string }) => n.status === 'PENDING') ?? []

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            {pending.length > 0 && (
              <p className="text-sm text-[#C30017] mt-1 font-medium">{pending.length} unread</p>
            )}
          </div>
        </div>

        <Card>
          <div className="divide-y divide-gray-100">
            {notifications?.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <Bell size={32} className="mx-auto mb-3 opacity-30" />
                <p>No notifications yet</p>
              </div>
            )}
            {notifications?.map((n: { id: string; event: string; subject: string; body: string; status: string; createdAt: string; channel: string }) => (
              <div
                key={n.id}
                className={`px-6 py-4 flex gap-4 items-start transition-colors ${n.status === 'PENDING' ? 'bg-blue-50/50' : ''}`}
              >
                <div className="mt-0.5 flex-shrink-0">{notifIcon(n.event)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-gray-900 text-sm">{n.subject}</p>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(n.createdAt), 'dd MMM HH:mm')}
                    </span>
                  </div>
                  <p
                    className="text-sm text-gray-600 mt-0.5"
                    dangerouslySetInnerHTML={{ __html: n.body }}
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wide">{n.channel}</span>
                    {n.status === 'PENDING' && (
                      <button
                        onClick={() => readMutation.mutate(n.id)}
                        className="text-xs text-[#C30017] hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Shell>
  )
}
