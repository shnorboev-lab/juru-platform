'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'next/navigation'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

type Employee = {
  id: string; juruId?: string; fullName: string; email: string; grade: string; position?: string
  team?: { id: string; name: string }; bu?: { id: string; name: string }
}
type SubResult = { subCriterion: string; scoreE1: number; scoreE2: number; weightedScore: number }
type Attendee = { id: string; employeeId: string; notes?: string; employee: { id: string; fullName: string; grade: string } }
type Result = {
  employeeId: string; overallAvg: number; performanceLabel: string
  isAtRisk: boolean; isNominated: boolean; belowCount: number
  interviewNote?: string; interviewDoneAt?: string; interviewScheduledAt?: string
  buNote?: string
  subResults: SubResult[]
}
type EmpItem = { id: string; fullName: string; grade: string; juruId?: string; team?: { name: string } }
type Submission = {
  id: string; type: string; status: string; submittedAt?: string; comment?: string
  scores: { subCriterion: string; score: number; note?: string }[]
}

const CRITERION_LABEL: Record<string, string> = {
  TIMELINE:          'Timeline',
  QUALITY:           'Quality of Work',
  CLIENT_SATISFACTION: 'Client Satisfaction',
  TEAMWORK:          'Teamwork',
  COMMERCIAL_SUCCESS: 'Commercial Success',
  TECHNICAL_SKILLS:  'Technical Skills',
  PEOPLE_SKILLS:     'People Skills',
  CONTINUOUS_LEARNING: 'Continuous Learning',
  DISCIPLINE:        'Discipline',
  RELIABILITY:       'Reliability',
}

const LABEL_COLOR: Record<string, string> = {
  EXCEPTIONAL:          'bg-green-100 text-green-800',
  EXCEEDS_EXPECTATIONS: 'bg-emerald-100 text-emerald-700',
  MEETS_EXPECTATIONS:   'bg-blue-100 text-blue-700',
  PARTIALLY_MEETS:      'bg-amber-100 text-amber-700',
  BELOW_EXPECTATIONS:   'bg-red-100 text-red-700',
}
const LABEL_FULL: Record<string, string> = {
  EXCEPTIONAL:          'Exceptional',
  EXCEEDS_EXPECTATIONS: 'Exceeds Expectations',
  MEETS_EXPECTATIONS:   'Meets Expectations',
  PARTIALLY_MEETS:      'Partially Meets',
  BELOW_EXPECTATIONS:   'Below Expectations',
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, max = 5, color = 'bg-[#C30017]' }: { score: number; max?: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${(score / max) * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{score.toFixed(1)}</span>
    </div>
  )
}

// ─── Interview Guide ──────────────────────────────────────────────────────────

const INTERVIEW_GUIDE = [
  {
    step: '1',
    title: 'Open with context',
    body: 'Remind the employee of the purpose of the conversation — this is a development discussion, not a judgement. Make it two-way.',
  },
  {
    step: '2',
    title: 'Review self-appraisal together',
    body: "Walk through the employee's self-appraisal. Ask them to elaborate on areas they scored themselves lower. Listen more than you talk.",
  },
  {
    step: '3',
    title: 'Share evaluation results',
    body: "Present the consolidated scores. Highlight strong criteria first. For any criterion below 2.5, give specific, behavioural examples — not personal judgements.",
  },
  {
    step: '4',
    title: 'Discuss development areas',
    body: 'For each below-expectations area, agree on concrete actions: training, mentoring, stretch assignments. Set a timeline.',
  },
  {
    step: '5',
    title: 'At-risk or nominated employees',
    body: 'At-risk: be honest and compassionate. Agree a clear improvement plan with check-in dates. Nominated: celebrate the achievement and discuss promotion or stretch opportunities.',
  },
  {
    step: '6',
    title: 'Close with a summary',
    body: 'Summarise what was agreed. Ask the employee if they feel heard. Record your notes below before leaving the page.',
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewDetailPage() {
  const params       = useParams()
  const searchParams = useSearchParams()
  const employeeId   = params.employeeId as string
  const cycleId      = searchParams.get('cycleId') ?? ''

  const [me, setMe]               = useState<Me | null>(null)
  const [note, setNote]           = useState('')
  const [buNote, setBuNote]       = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [attSearch, setAttSearch] = useState('')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [showGuide, setShowGuide] = useState(false)
  const [showSelf, setShowSelf]   = useState(false)
  const [showEval, setShowEval]   = useState(true)
  const [showSchedule, setShowSchedule] = useState(true)
  const [toast, setToast]         = useState<string | null>(null)
  const qc = useQueryClient()

  useEffect(() => { getMe().then(setMe) }, [])
  function showToastMsg(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const { data: employee } = useQuery<Employee>({
    queryKey: ['employee', employeeId],
    queryFn: () => api.get(`/employees/${employeeId}`).then(r => r.data),
    enabled: !!employeeId,
  })
  const { data: result } = useQuery<Result>({
    queryKey: ['result-detail', cycleId, employeeId],
    queryFn: () => api.get(`/results/${cycleId}/${employeeId}`).then(r => r.data),
    enabled: !!cycleId && !!employeeId,
  })
  const { data: submissions } = useQuery<Submission[]>({
    queryKey: ['submissions-detail', cycleId, employeeId],
    queryFn: () => api.get(`/submissions?cycleId=${cycleId}&employeeId=${employeeId}`).then(r => r.data),
    enabled: !!cycleId && !!employeeId,
  })
  const { data: allEmployees } = useQuery<EmpItem[]>({
    queryKey: ['employees-for-invite'],
    queryFn: () => api.get('/employees?isActive=true').then(r => r.data),
    enabled: !!me && (me.role === 'TEAM_HEAD' || me.role === 'HR_ADMIN'),
  })

  useEffect(() => {
    if (result?.interviewNote) setNote(result.interviewNote)
    if (result?.interviewScheduledAt) setScheduledAt(result.interviewScheduledAt.slice(0, 16))
    if (result?.buNote) setBuNote(result.buNote)
  }, [result?.interviewNote, result?.interviewScheduledAt, result?.buNote])

  const scheduleMutation = useMutation({
    mutationFn: () => api.patch(`/results/${cycleId}/${employeeId}/interview`, {
      scheduledAt, attendeeIds: attendees.map(a => a.employeeId),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['result-detail', cycleId, employeeId] }); showToastMsg('Interview scheduled — notifications sent') },
  })

  const saveMutation = useMutation({
    mutationFn: (done: boolean) => api.patch(`/results/${cycleId}/${employeeId}/interview`, { note, done }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['result-detail', cycleId, employeeId] }); showToastMsg('Interview notes saved') },
  })

  const saveBuNoteMutation = useMutation({
    mutationFn: () => api.patch(`/results/${cycleId}/${employeeId}/bu-note`, { note: buNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['result-detail', cycleId, employeeId] }); showToastMsg('Your notes saved') },
  })

  const addAttendeeMutation = useMutation({
    mutationFn: (empId: string) => api.post(`/check-ins/noop`, {}), // handled inline below
    onSuccess: () => {},
  })

  function addAttendee(emp: EmpItem) {
    if (attendees.find(a => a.employeeId === emp.id)) return
    setAttendees(prev => [...prev, {
      id: `temp-${emp.id}`, employeeId: emp.id, notes: undefined,
      employee: { id: emp.id, fullName: emp.fullName, grade: emp.grade },
    }])
    setAttSearch('')
  }
  function removeAttendee(empId: string) { setAttendees(prev => prev.filter(a => a.employeeId !== empId)) }

  const isTeamHeadOrHR = me?.role === 'TEAM_HEAD' || me?.role === 'HR_ADMIN'
  const isBuHead = me?.role === 'BU_HEAD'

  const filteredEmps = (allEmployees ?? []).filter(e =>
    e.id !== employeeId &&
    !attendees.find(a => a.employeeId === e.id) &&
    (e.fullName.toLowerCase().includes(attSearch.toLowerCase()) || (e.juruId ?? '').includes(attSearch))
  ).slice(0, 8)

  if (!me || !employee) return null

  const selfSub = submissions?.find(s => s.type === 'SELF')
  const eval1   = submissions?.find(s => s.type === 'EVAL_1')
  const eval2   = submissions?.find(s => s.type === 'EVAL_2')

  return (
    <Shell me={me}>
      <div className="p-8 max-w-4xl mx-auto space-y-6">

        {toast && (
          <div className="fixed top-5 right-5 z-50 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg">✓ {toast}</div>
        )}

        {/* Back + header */}
        <div>
          <Link href={`/interviews`} className="text-sm text-gray-400 hover:text-[#C30017] flex items-center gap-1 mb-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
            Back to interviews
          </Link>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#f5e6e9] text-[#C30017] flex items-center justify-center font-bold text-xl">
                {employee.fullName.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{employee.fullName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  {employee.juruId && <span className="font-mono text-sm text-gray-400">{employee.juruId}</span>}
                  <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono font-medium">{employee.grade}</span>
                  {employee.team && <span className="text-sm text-gray-500">{employee.team.name}</span>}
                  {employee.bu   && <span className="text-sm text-gray-400">· {employee.bu.name}</span>}
                </div>
                {employee.position && <p className="text-sm text-gray-400 mt-0.5">{employee.position}</p>}
              </div>
            </div>
            {result && (
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900">{Number(result.overallAvg).toFixed(2)}</p>
                <span className={`text-sm font-medium px-3 py-1 rounded-full ${LABEL_COLOR[result.performanceLabel]}`}>
                  {LABEL_FULL[result.performanceLabel]}
                </span>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  {result.isAtRisk    && <span className="text-xs text-red-500 font-medium">⚠ At Risk ({result.belowCount} below)</span>}
                  {result.isNominated && <span className="text-xs text-green-500 font-medium">★ Nominated</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Self-Appraisal section */}
        <Card>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => setShowSelf(v => !v)}>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">Self-Appraisal</span>
              {selfSub ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selfSub.status === 'SUBMITTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {selfSub.status === 'SUBMITTED'
                    ? `Submitted ${selfSub.submittedAt ? new Date(selfSub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''}`
                    : 'Draft'}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not submitted</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showSelf ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {showSelf && selfSub && (
            <div className="px-6 pb-5 space-y-3 border-t border-gray-50">
              {selfSub.comment && (
                <div className="bg-gray-50 rounded-xl p-4 mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-1">General comment</p>
                  <p className="text-sm text-gray-700">{selfSub.comment}</p>
                </div>
              )}
              <div className="space-y-2 mt-4">
                {selfSub.scores.map(s => (
                  <div key={s.subCriterion} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-44 shrink-0">{CRITERION_LABEL[s.subCriterion] ?? s.subCriterion}</span>
                    <ScoreBar score={s.score} color="bg-blue-400" />
                    {s.note && <span className="text-xs text-gray-400 italic truncate max-w-[200px]">{s.note}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {showSelf && !selfSub && (
            <p className="px-6 pb-5 text-sm text-gray-400 border-t border-gray-50 pt-4">No self-appraisal submitted yet.</p>
          )}
        </Card>

        {/* Evaluation Results section */}
        <Card>
          <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => setShowEval(v => !v)}>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-gray-900">Evaluation Results</span>
              {result ? (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${LABEL_COLOR[result.performanceLabel]}`}>
                  {Number(result.overallAvg).toFixed(2)} · {LABEL_FULL[result.performanceLabel]}
                </span>
              ) : (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Not calculated yet</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${showEval ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {showEval && result && (
            <div className="px-6 pb-5 border-t border-gray-50">
              <div className="grid grid-cols-3 gap-4 py-4 border-b border-gray-50 mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Evaluator 1 (70%)</p>
                  <p className="text-sm font-medium text-gray-700">
                    Avg: {eval1?.scores.length ? (eval1.scores.reduce((s, c) => s + c.score, 0) / eval1.scores.length).toFixed(2) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Evaluator 2 (30%)</p>
                  <p className="text-sm font-medium text-gray-700">
                    Avg: {eval2?.scores.length ? (eval2.scores.reduce((s, c) => s + c.score, 0) / eval2.scores.length).toFixed(2) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Consolidated</p>
                  <p className="text-lg font-bold text-gray-900">{Number(result.overallAvg).toFixed(2)}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-[11rem_1fr_1fr_1fr] gap-2 text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">
                  <span>Criterion</span><span>E1</span><span>E2</span><span>Consolidated</span>
                </div>
                {result.subResults.map(sr => (
                  <div key={sr.subCriterion} className="grid grid-cols-[11rem_1fr_1fr_1fr] gap-2 items-center">
                    <span className="text-sm text-gray-600">{CRITERION_LABEL[sr.subCriterion] ?? sr.subCriterion}</span>
                    <ScoreBar score={sr.scoreE1} color="bg-blue-300" />
                    <ScoreBar score={sr.scoreE2} color="bg-purple-300" />
                    <ScoreBar score={sr.weightedScore} color={sr.weightedScore < 1.5 ? 'bg-red-400' : sr.weightedScore >= 4 ? 'bg-green-500' : 'bg-[#C30017]'} />
                  </div>
                ))}
              </div>
            </div>
          )}
          {showEval && !result && (
            <p className="px-6 pb-5 text-sm text-gray-400 border-t border-gray-50 pt-4">Scores not calculated yet. Go to Evaluations and click "Calculate Scores".</p>
          )}
        </Card>

        {/* Schedule & Attendees */}
        {isTeamHeadOrHR && (
          <Card>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowSchedule(v => !v)}>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">Schedule Interview</span>
                {result?.interviewScheduledAt && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                    📅 {new Date(result.interviewScheduledAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showSchedule ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {showSchedule && (
              <div className="px-6 pb-5 border-t border-gray-50 space-y-4 pt-4">
                {/* Date/time picker */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Interview date &amp; time</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
                </div>

                {/* Attendees */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Invite attendees (optional)</label>
                  <div className="relative">
                    <input value={attSearch} onChange={e => setAttSearch(e.target.value)}
                      placeholder="Search by name or Juru ID…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017]" />
                    {attSearch && filteredEmps.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        {filteredEmps.map(e => (
                          <button key={e.id} onClick={() => addAttendee(e)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2">
                            <span className="font-medium">{e.fullName}</span>
                            <span className="text-xs text-gray-400">{e.grade} · {e.team?.name ?? '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {attendees.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {attendees.map(a => (
                        <span key={a.employeeId} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full">
                          {a.employee.fullName}
                          <button onClick={() => removeAttendee(a.employeeId)} className="text-gray-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Attendees receive an in-app notification and a Google Calendar link.</p>
                </div>

                <button
                  onClick={() => scheduleMutation.mutate()}
                  disabled={!scheduledAt || scheduleMutation.isPending}
                  className="px-4 py-2 bg-[#C30017] text-white text-sm font-medium rounded-lg hover:bg-[#a30014] disabled:opacity-40">
                  {scheduleMutation.isPending ? 'Scheduling…' : '📅 Set Schedule & Notify'}
                </button>
              </div>
            )}
          </Card>
        )}

        {/* Interview Guide — only for team head / HR */}
        {!isBuHead && (
          <Card>
            <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              onClick={() => setShowGuide(v => !v)}>
              <span className="font-semibold text-gray-900">Interview Guide</span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showGuide ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
            {showGuide && (
              <div className="px-6 pb-5 border-t border-gray-50">
                <div className="space-y-4 mt-4">
                  {INTERVIEW_GUIDE.map(g => (
                    <div key={g.step} className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-[#f5e6e9] text-[#C30017] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {g.step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{g.title}</p>
                        <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{g.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Interview Notes — editable for Team Head / HR, read-only for BU Head */}
        <Card>
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Interview Notes</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {isBuHead ? 'Notes recorded by the team head during the interview' : (
                  result?.interviewDoneAt
                    ? `Interview completed ${new Date(result.interviewDoneAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : 'Not yet marked as done'
                )}
              </p>
            </div>
            {result?.interviewDoneAt && (
              <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">✓ Interview Completed</span>
            )}
          </div>
          {isBuHead ? (
            <div className="p-5">
              {result?.interviewNote ? (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {result.interviewNote}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No interview notes recorded yet.</p>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-4">
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={8}
                placeholder="Record your interview notes here — key discussion points, agreed actions, development plan, follow-up dates…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none"
              />
              <div className="flex items-center gap-3">
                <Button onClick={() => saveMutation.mutate(false)} loading={saveMutation.isPending} variant="secondary">
                  Save Notes
                </Button>
                <Button onClick={() => saveMutation.mutate(true)} loading={saveMutation.isPending}>
                  ✓ Mark Interview as Done & Save
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* BU Head notes — only visible to BU Head */}
        {isBuHead && (
          <Card>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Your Feedback</h3>
              <p className="text-xs text-gray-400 mt-0.5">Add your own observations or feedback about this employee's performance</p>
            </div>
            <div className="p-5 space-y-4">
              <textarea
                value={buNote}
                onChange={e => setBuNote(e.target.value)}
                rows={6}
                placeholder="Add your perspective on this employee's performance — development potential, promotion considerations, cross-team observations…"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none"
              />
              <Button onClick={() => saveBuNoteMutation.mutate()} loading={saveBuNoteMutation.isPending}>
                Save Feedback
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  )
}
