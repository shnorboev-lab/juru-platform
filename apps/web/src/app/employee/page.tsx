'use client'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me, logout } from '@/lib/auth'

type Notification = {
  id: string; event: string; subject: string; body: string
  status: string; sentAt?: string; createdAt: string
}

const EVENT_ICONS: Record<string, string> = {
  CYCLE_STARTED:     '🚀',
  DEADLINE_REMINDER: '⏰',
  RESULTS_RELEASED:  '✅',
  EVALUATION_READY:  '📋',
  DEFAULT:           '📬',
}

export default function EmployeePage() {
  const [me, setMe] = useState<Me | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['my-notifications'],
    queryFn: () => api.get('/notifications?limit=20').then(r => r.data),
    enabled: !!me,
    refetchInterval: 60_000,
  })

  if (!me) return null

  const unread = notifications?.filter(n => n.status === 'PENDING').length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://www.juru.org/images/Logo.svg" alt="Juru" className="h-7"
            style={{ filter: 'invert(10%) sepia(90%) saturate(4000%) hue-rotate(340deg) brightness(80%)' }} />
          <span className="font-semibold text-gray-900">Performance Review</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{me.fullName}</span>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Welcome card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 text-center">
          <div className="w-16 h-16 bg-[#f5e6e9] rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#C30017]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 00-9.33-4.993M9 7a6 6 0 016 6v3.158c0 .538.214 1.055.595 1.436L17 17H9m0 0v1a3 3 0 006 0v-1m-6 0H3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Hello, {me.fullName.split(' ')[0]}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your performance review notifications will be sent to your Juru email address.<br />
            You&apos;ll hear from us when a review cycle opens or your results are ready.
          </p>
          {unread > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 bg-[#f5e6e9] text-[#C30017] text-sm font-medium px-4 py-2 rounded-full">
              <span className="w-2 h-2 bg-[#C30017] rounded-full animate-pulse"/>
              {unread} unread notification{unread > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">Recent notifications</h2>
          {!notifications?.length && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
              No notifications yet
            </div>
          )}
          {notifications?.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-5 flex gap-4 hover:border-gray-200 transition-colors">
              <div className="text-2xl shrink-0 mt-0.5">
                {EVENT_ICONS[n.event] ?? EVENT_ICONS.DEFAULT}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{n.subject}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-xs text-gray-400 mt-1.5">
                  {n.sentAt
                    ? new Date(n.sentAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
                    : 'Pending'}
                </p>
              </div>
              {n.status === 'PENDING' && (
                <div className="shrink-0 w-2 h-2 bg-[#C30017] rounded-full mt-1.5"/>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
