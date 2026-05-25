'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type Employee = { id: string; fullName: string; grade: string; juruId?: string; team?: { name: string } }
type CheckIn = {
  id: string
  initiatorId: string
  employeeId: string
  scheduledAt?: string
  agenda?: string
  notes?: string
  employeeNotes?: string
  status: 'SCHEDULED' | 'DONE' | 'CANCELLED'
  createdAt: string
  employee?: { id: string; fullName: string; grade: string; team?: { name: string } }
  initiator?: { id: string; fullName: string }
}

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-700',
  DONE:      'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

function NewCheckInModal({ employees, onClose, onCreated }: {
  employees: Employee[]
  onClose: () => void
  onCreated: () => void
}) {
  const [employeeId, setEmployeeId] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [agenda, setAgenda] = useState('')
  const [search, setSearch] = useState('')

  const filtered = employees.filter(e =>
    e.fullName.toLowerCase().includes(search.toLowerCase()) || (e.juruId ?? '').includes(search)
  )

  const mutation = useMutation({
    mutationFn: () => api.post('/check-ins', { employeeId, scheduledAt: scheduledAt || undefined, agenda: agenda || undefined }),
    onSuccess: () => { onCreated(); onClose() },
  })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Schedule 1:1 Check-in</h2>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Search employee</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type name or Juru ID…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] mb-2" />
          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {filtered.slice(0, 20).map(e => (
              <button key={e.id} onClick={() => setEmployeeId(e.id)}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  employeeId === e.id ? 'bg-[#f5e6e9] text-[#C30017]' : 'hover:bg-gray-50'
                }`}>
                <span className="font-medium">{e.fullName}</span>
                <span className="text-xs text-gray-400 ml-2">{e.grade} · {e.team?.name ?? '—'}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No results</p>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date &amp; time (optional)</label>
          <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Agenda / topics</label>
          <textarea value={agenda} onChange={e => setAgenda(e.target.value)} rows={3}
            placeholder="What would you like to discuss?"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none" />
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" disabled={!employeeId || mutation.isPending}
            onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Scheduling…' : 'Schedule & Notify'}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CheckInCard({ checkIn, me, onUpdate }: { checkIn: CheckIn; me: Me; onUpdate: () => void }) {
  const [open, setOpen]           = useState(false)
  const [notes, setNotes]         = useState(checkIn.notes ?? '')
  const [empNotes, setEmpNotes]   = useState(checkIn.employeeNotes ?? '')
  const qc = useQueryClient()

  const isInitiator = me.id === checkIn.initiatorId
  const isEmployee  = me.id === checkIn.employeeId

  const updateMutation = useMutation({
    mutationFn: (data: object) => api.patch(`/check-ins/${checkIn.id}`, data),
    onSuccess: () => { onUpdate(); qc.invalidateQueries({ queryKey: ['check-ins'] }) },
  })
  const completeMutation = useMutation({
    mutationFn: () => api.post(`/check-ins/${checkIn.id}/complete`, { notes }),
    onSuccess: () => { onUpdate(); qc.invalidateQueries({ queryKey: ['check-ins'] }) },
  })
  const empNotesMutation = useMutation({
    mutationFn: () => api.patch(`/check-ins/${checkIn.id}/employee-notes`, { employeeNotes: empNotes }),
    onSuccess: () => { onUpdate(); qc.invalidateQueries({ queryKey: ['check-ins'] }) },
  })

  const person = isInitiator ? checkIn.employee : checkIn.initiator

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/60 transition-colors text-left">
        <div className="w-9 h-9 rounded-full bg-[#f5e6e9] text-[#C30017] flex items-center justify-center font-bold text-sm shrink-0">
          {(person as any)?.fullName?.split(' ').map((n: string) => n[0]).slice(0,2).join('') ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900">{(person as any)?.fullName ?? '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {checkIn.scheduledAt
              ? new Date(checkIn.scheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
              : 'No date set'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[checkIn.status]}`}>
            {checkIn.status === 'SCHEDULED' ? '● Scheduled' : checkIn.status === 'DONE' ? '✓ Done' : 'Cancelled'}
          </span>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
          </svg>
        </div>
      </button>

      {open && (
        <div className="p-4 border-t border-gray-100 bg-gray-50/40 space-y-4">
          {checkIn.agenda && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Agenda</p>
              <p className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100">{checkIn.agenda}</p>
            </div>
          )}

          {/* Team head notes */}
          {isInitiator && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Your notes {checkIn.status === 'DONE' && '(shared with employee)'}</p>
              <textarea rows={4} value={notes} onChange={e => setNotes(e.target.value)}
                disabled={checkIn.status === 'DONE'}
                placeholder="Add interview notes, key discussion points, action items…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none disabled:bg-gray-50 disabled:text-gray-400" />
              {checkIn.status !== 'DONE' && (
                <div className="flex gap-2 mt-2">
                  <button onClick={() => updateMutation.mutate({ notes })}
                    disabled={updateMutation.isPending}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
                    Save Draft
                  </button>
                  <button onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="text-xs px-3 py-1.5 bg-[#C30017] text-white rounded-lg hover:bg-[#a30014] font-medium">
                    {completeMutation.isPending ? 'Completing…' : 'Mark as Done & Share Notes'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Employee sees team head notes after done */}
          {isEmployee && checkIn.status === 'DONE' && checkIn.notes && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Notes from {checkIn.initiator?.fullName}</p>
              <div className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">{checkIn.notes}</div>
            </div>
          )}

          {/* Employee notes */}
          {(isEmployee || (isInitiator && checkIn.employeeNotes)) && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">
                {isEmployee ? 'Your notes' : `Notes from ${checkIn.employee?.fullName}`}
              </p>
              {isEmployee ? (
                <>
                  <textarea rows={3} value={empNotes} onChange={e => setEmpNotes(e.target.value)}
                    placeholder="Add your own notes, questions, or reflections…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none" />
                  <button onClick={() => empNotesMutation.mutate()}
                    disabled={empNotesMutation.isPending}
                    className="mt-1.5 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
                    {empNotesMutation.isPending ? 'Saving…' : 'Save Notes'}
                  </button>
                </>
              ) : (
                <div className="text-sm text-gray-700 bg-white rounded-lg p-3 border border-gray-100 whitespace-pre-wrap">{checkIn.employeeNotes}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CheckInsPage() {
  const [me, setMe]   = useState<Me | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter]   = useState<'ALL' | 'SCHEDULED' | 'DONE'>('ALL')
  const qc = useQueryClient()
  useEffect(() => { getMe().then(setMe) }, [])

  const isTeamHead = me?.role === 'TEAM_HEAD' || me?.role === 'HR_ADMIN'

  const { data: checkIns, refetch } = useQuery<CheckIn[]>({
    queryKey: ['check-ins'],
    queryFn:  () => api.get('/check-ins').then(r => r.data),
    enabled:  !!me,
    refetchInterval: 30_000,
  })
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees-checkin'],
    queryFn:  () => api.get('/employees?isActive=true').then(r => r.data),
    enabled:  !!me && isTeamHead,
  })

  if (!me) return null

  const filtered = (checkIns ?? []).filter(c => filter === 'ALL' || c.status === filter)
  const scheduled = (checkIns ?? []).filter(c => c.status === 'SCHEDULED').length
  const done      = (checkIns ?? []).filter(c => c.status === 'DONE').length

  return (
    <Shell me={me}>
      <div className="p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">1:1 Check-ins</h1>
            <p className="text-sm text-gray-500 mt-1">
              {isTeamHead ? 'Schedule and manage check-in meetings with your team' : 'Your scheduled check-ins with your team head'}
            </p>
          </div>
          {isTeamHead && (
            <Button onClick={() => setShowNew(true)}>
              + New Check-in
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Scheduled</p>
            <p className="text-2xl font-bold text-blue-600">{scheduled}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">Completed</p>
            <p className="text-2xl font-bold text-green-600">{done}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {(['ALL', 'SCHEDULED', 'DONE'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {f === 'ALL' ? 'All' : f === 'SCHEDULED' ? 'Upcoming' : 'Completed'}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No check-ins yet</p>
            {isTeamHead && <p className="text-sm mt-1">Click "New Check-in" to schedule one with a team member.</p>}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(c => (
              <CheckInCard key={c.id} checkIn={c} me={me} onUpdate={() => refetch()} />
            ))}
          </div>
        )}
      </div>

      {showNew && employees && (
        <NewCheckInModal
          employees={employees}
          onClose={() => setShowNew(false)}
          onCreated={() => { refetch(); qc.invalidateQueries({ queryKey: ['check-ins'] }) }}
        />
      )}
    </Shell>
  )
}
