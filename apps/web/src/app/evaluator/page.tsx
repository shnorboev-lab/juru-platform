'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { api } from '@/lib/api'
import { getMe, type Me } from '@/lib/auth'
import { Shell } from '@/components/Shell'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

// ─── Criterion definitions ────────────────────────────────────────────────────

const SUB_CRITERIA = [
  { key: 'TIMELINE',            group: 'Project Delivery',                   label: 'Timeline' },
  { key: 'QUALITY',             group: 'Project Delivery',                   label: 'Quality of Work' },
  { key: 'CLIENT_SATISFACTION', group: 'Project Delivery',                   label: 'Client Satisfaction' },
  { key: 'TEAMWORK',            group: 'Project Delivery',                   label: 'Teamwork & Collaboration' },
  { key: 'COMMERCIAL_SUCCESS',  group: 'Project Delivery',                   label: 'Commercial Success' },
  { key: 'TECHNICAL_SKILLS',    group: 'Personal & Professional Development', label: 'Technical Skills' },
  { key: 'PEOPLE_SKILLS',       group: 'Personal & Professional Development', label: 'People Skills' },
  { key: 'CONTINUOUS_LEARNING', group: 'Personal & Professional Development', label: 'Continuous Learning' },
  { key: 'DISCIPLINE',          group: 'Personal & Professional Development', label: 'Discipline' },
  { key: 'RELIABILITY',         group: 'Personal & Professional Development', label: 'Reliability' },
]

const SCORE_LABELS = [
  { v: 1, label: 'Below Expectations',   color: 'text-red-700',    ring: 'ring-red-400',    activeBg: 'bg-red-50 border-red-400' },
  { v: 2, label: 'Partially Meets',      color: 'text-orange-700', ring: 'ring-orange-400', activeBg: 'bg-orange-50 border-orange-400' },
  { v: 3, label: 'Meets Expectations',   color: 'text-yellow-700', ring: 'ring-yellow-400', activeBg: 'bg-yellow-50 border-yellow-400' },
  { v: 4, label: 'Exceeds Expectations', color: 'text-blue-700',   ring: 'ring-blue-400',   activeBg: 'bg-blue-50 border-blue-400' },
  { v: 5, label: 'Exceptional',          color: 'text-green-700',  ring: 'ring-green-500',  activeBg: 'bg-green-50 border-green-500' },
]

// ─── Grade-specific rubric descriptions ──────────────────────────────────────

type Seniority = 'ENTRY' | 'MID' | 'SENIOR'

function getSeniority(grade: string): Seniority {
  const entry = ['E1','E2','E3','E4','C1','C2','C3','C4','S1','S2','S3','S4','I']
  const mid   = ['SE1','SE2','SE3','SE4','SC1','SC2','SC3','SC4']
  if (entry.includes(grade)) return 'ENTRY'
  if (mid.includes(grade))   return 'MID'
  return 'SENIOR'
}

const RUBRIC: Record<string, Record<Seniority, Record<number, string>>> = {
  TIMELINE: {
    ENTRY: {
      1: 'Frequently misses deadlines despite close guidance; requires constant follow-up.',
      2: 'Meets deadlines inconsistently; occasionally needs reminders to stay on track.',
      3: 'Meets most deadlines reliably with normal supervision.',
      4: 'Consistently meets or beats deadlines; proactively flags risks early.',
      5: 'Never misses a deadline; actively helps peers manage their own timelines.',
    },
    MID: {
      1: 'Regularly delays deliverables; causes visible impact on project progress.',
      2: 'Meets timelines inconsistently; reactive to problems rather than proactive.',
      3: 'Reliably delivers on schedule across own workstreams.',
      4: 'Delivers ahead of schedule; manages scope and dependencies effectively.',
      5: 'Sets the delivery pace for the team; recognised as the model for schedule discipline.',
    },
    SENIOR: {
      1: 'Project milestones routinely slip due to poor planning or failure to escalate.',
      2: 'Delivery is unpredictable; the team absorbs consequences of missed commitments.',
      3: 'Manages timelines across complex programmes; adjusts plans proactively.',
      4: 'Drives on-time delivery across multi-team or multi-workstream initiatives.',
      5: 'Defines delivery standards adopted across the BU; cited as best practice by leadership.',
    },
  },
  QUALITY: {
    ENTRY: {
      1: 'Output frequently requires significant rework before it can be used.',
      2: 'Work quality is uneven; errors require regular correction by seniors.',
      3: 'Produces work that meets basic quality standards for the role.',
      4: 'Produces high-quality work with minimal revision needed.',
      5: 'Output is consistently excellent and used as a benchmark by the wider team.',
    },
    MID: {
      1: 'Quality is insufficient for mid-level; heavy rework required by seniors.',
      2: 'Quality is inconsistent; some deliverables fall below expected standard.',
      3: 'Consistently produces work of solid quality appropriate to the role.',
      4: 'High-quality output; anticipates issues and addresses them before review.',
      5: 'Work is exemplary; demonstrably raises the quality bar for the whole team.',
    },
    SENIOR: {
      1: 'Output quality undermines credibility; significant revision required by peers or leadership.',
      2: 'Quality does not meet senior expectations; gaps in rigour and attention to detail.',
      3: 'Produces reliable, high-quality work appropriate to seniority.',
      4: 'Consistently excellent quality; establishes standards adopted by others.',
      5: 'Sets organisation-wide quality benchmarks; work is referenced as best practice.',
    },
  },
  CLIENT_SATISFACTION: {
    ENTRY: {
      1: 'Client interactions cause dissatisfaction; needs significant coaching on professionalism.',
      2: 'Client relationships are strained; inconsistent professionalism in interactions.',
      3: 'Meets client expectations reliably with standard guidance.',
      4: 'Clients are consistently positive; builds good, trusted working relationships.',
      5: 'Clients specifically request this person by name; strong trust-based relationships.',
    },
    MID: {
      1: 'Client feedback is negative; relationship damage is evident.',
      2: 'Client satisfaction is mixed; limited ability to manage expectations independently.',
      3: 'Maintains satisfactory client relationships without close supervision.',
      4: 'Proactively manages expectations; earns repeat engagement and positive feedback.',
      5: 'Clients regard this person as a trusted advisor; instrumental in account retention.',
    },
    SENIOR: {
      1: 'Client relationships are at risk; escalations or formal complaints have occurred.',
      2: 'Client engagement is below the expected standard for a senior professional.',
      3: 'Maintains strong client relationships; solid and reliable delivery track record.',
      4: 'Drives client satisfaction scores; resolves complex issues with strategic thinking.',
      5: 'Converts clients into long-term strategic partners; measurable impact on revenue.',
    },
  },
  TEAMWORK: {
    ENTRY: {
      1: 'Works in isolation; avoids collaboration or causes friction within the team.',
      2: 'Participates in team activities reluctantly; makes limited contribution.',
      3: 'Collaborates effectively within the team; good team player.',
      4: 'Actively supports teammates; contributes meaningfully to a positive team culture.',
      5: 'Elevates team performance noticeably; recognised as a collaborative role model.',
    },
    MID: {
      1: 'Undermines team cohesion; difficult to work with across functions.',
      2: 'Collaboration is transactional; contributes little beyond own assigned tasks.',
      3: 'Reliable team player; contributes constructively to joint deliverables.',
      4: 'Actively strengthens team dynamics; bridges cross-functional gaps effectively.',
      5: 'Creates high-performing team environments; fosters psychological safety.',
    },
    SENIOR: {
      1: 'Creates organisational silos; does not model expected collaborative behaviour.',
      2: 'Collaboration is inconsistent; misses opportunities to connect teams.',
      3: 'Fosters strong collaboration within and beyond their immediate team.',
      4: 'Builds cross-BU relationships that enable effective joint delivery.',
      5: 'Defines collaborative culture; behaviour is cited as an example by leadership.',
    },
  },
  COMMERCIAL_SUCCESS: {
    ENTRY: {
      1: 'Unaware of the commercial implications of their work.',
      2: 'Limited commercial awareness; rarely considers cost or value implications.',
      3: 'Understands the basic commercial context of their role.',
      4: 'Demonstrates commercial awareness; contributes to value-driven delivery.',
      5: 'Actively supports commercial outcomes; helps win or retain business.',
    },
    MID: {
      1: 'Commercial awareness is absent; decisions ignore financial or strategic impact.',
      2: 'Commercial thinking is inconsistent; misses opportunities to add value.',
      3: 'Understands commercial goals and supports their achievement effectively.',
      4: 'Actively contributes to commercial success; identifies growth levers.',
      5: 'Directly drives commercial results — revenue, margin, or strategic pipeline.',
    },
    SENIOR: {
      1: 'Commercial decisions are poor; negatively impacts project or BU profitability.',
      2: 'Commercial leadership is below expectations for a senior professional.',
      3: 'Meets commercial targets; manages budget and margin effectively.',
      4: 'Exceeds targets; opens new revenue streams or secures strategic accounts.',
      5: 'Defines commercial strategy for the BU; their approach drives top-line growth.',
    },
  },
  TECHNICAL_SKILLS: {
    ENTRY: {
      1: 'Technical skills are significantly below what the role requires.',
      2: 'Technical capability is developing but has notable gaps that slow delivery.',
      3: 'Technical skills meet role expectations; performs core tasks competently.',
      4: 'Strong technical skills; trusted to handle complex technical challenges independently.',
      5: 'Expert-level skills for grade; others actively seek their technical guidance.',
    },
    MID: {
      1: 'Technical skills are inadequate for a mid-level professional.',
      2: 'Competent in core areas but has significant gaps that limit impact.',
      3: 'Solid technical skills across the primary disciplines of the role.',
      4: 'Advanced expertise; drives technical quality and standards on projects.',
      5: 'Recognised technical authority; contributes to knowledge sharing and mentoring.',
    },
    SENIOR: {
      1: 'Technical credibility is undermined; unable to lead technical work effectively.',
      2: 'Technical skills insufficient to lead teams or credibly guide client conversations.',
      3: 'Strong technical grounding; provides effective technical leadership.',
      4: 'Domain expert; shapes technical direction and decisions for the team.',
      5: 'Industry-recognised expertise; thought leadership through speaking, writing, or advisory.',
    },
  },
  PEOPLE_SKILLS: {
    ENTRY: {
      1: 'Communication causes misunderstandings or interpersonal friction.',
      2: 'People skills are developing; occasional communication breakdowns.',
      3: 'Communicates clearly and professionally in most situations.',
      4: 'Builds strong relationships; known for empathy, clarity, and approachability.',
      5: 'Exceptional communicator; trusted and respected by all stakeholders.',
    },
    MID: {
      1: 'Poor people skills impact team dynamics and client relationships.',
      2: 'People skills are inconsistent; some stakeholder friction is evident.',
      3: 'Communicates effectively; handles interpersonal situations well.',
      4: 'Skilled influencer; navigates complex stakeholder dynamics with confidence.',
      5: 'Inspires and motivates others; recognised as a natural people leader.',
    },
    SENIOR: {
      1: 'Leadership style is undermining morale or stakeholder trust.',
      2: 'People leadership is below the expected standard for a senior professional.',
      3: 'Strong interpersonal skills; effective leadership communication.',
      4: 'Excellent people leadership; deliberately develops and elevates others.',
      5: 'Transformational leader; sets the cultural standard for people skills across the team.',
    },
  },
  CONTINUOUS_LEARNING: {
    ENTRY: {
      1: 'Resistant to learning; does not incorporate feedback or develop new skills.',
      2: 'Engages with learning opportunities only when required to do so.',
      3: 'Actively develops skills relevant to current and near-future role needs.',
      4: 'Pursues learning beyond requirements; applies new skills quickly and effectively.',
      5: 'Self-directed learner who shares knowledge to develop the team.',
    },
    MID: {
      1: 'No evidence of development; skills and knowledge have plateaued.',
      2: 'Learning is reactive; limited self-development initiative.',
      3: 'Commits to professional development; grows consistently year on year.',
      4: 'Proactively builds new capabilities; stays ahead of industry trends.',
      5: 'Drives a learning culture; creates development opportunities for others.',
    },
    SENIOR: {
      1: 'Not keeping pace with industry or technical developments relevant to their domain.',
      2: 'Development effort is below expectations for a senior professional.',
      3: 'Keeps skills current; contributes meaningfully to the team knowledge base.',
      4: 'Shapes the learning agenda for the team; brings in new knowledge and frameworks.',
      5: 'Defines thought leadership in their domain; active industry contributor.',
    },
  },
  DISCIPLINE: {
    ENTRY: {
      1: 'Fails to follow processes, standards, or instructions consistently.',
      2: 'Adherence to standards is inconsistent; frequent reminders are needed.',
      3: 'Follows processes and standards reliably in day-to-day work.',
      4: 'Adheres to standards and proactively helps improve them.',
      5: 'Models disciplined working practices; holds peers to equally high standards.',
    },
    MID: {
      1: 'Process compliance is poor; causes quality or risk issues for the team.',
      2: 'Standards are not consistently upheld; requires monitoring.',
      3: 'Follows and enforces standards consistently across their work.',
      4: 'Proactively strengthens processes; demonstrates strong governance mindset.',
      5: 'Defines best practices adopted by the team; working methods are emulated.',
    },
    SENIOR: {
      1: 'Governance and standards oversight is inadequate for a senior role.',
      2: 'Discipline in delivery and process is not at the expected senior level.',
      3: 'Sets strong standards; ensures compliance across teams and workstreams.',
      4: 'Drives governance improvements; measurably reduces risk across the BU.',
      5: 'Establishes compliance culture; defines standards adopted organisation-wide.',
    },
  },
  RELIABILITY: {
    ENTRY: {
      1: 'Cannot be depended on; commitments are frequently not met.',
      2: 'Reliability is inconsistent; requires regular follow-up to ensure delivery.',
      3: 'Generally reliable; delivers on commitments without being chased.',
      4: 'Highly reliable; goes above and beyond to follow through on commitments.',
      5: 'Absolute dependability; fully trusted to deliver without any supervision.',
    },
    MID: {
      1: 'Reliability issues impact project delivery and reduce team confidence.',
      2: 'Hit-or-miss delivery; team has to compensate for unpredictable output.',
      3: 'Consistently reliable across their own portfolio of work.',
      4: 'Trusted with the most critical tasks; proven track record of follow-through.',
      5: 'Benchmark for reliability on the team; never needs chasing, ever.',
    },
    SENIOR: {
      1: 'Reliability issues at senior level undermine team trust and leadership confidence.',
      2: "Delivery is unpredictable; leadership's confidence in commitments is affected.",
      3: 'Highly reliable; sets clear expectations and delivery norms for the team.',
      4: 'Drives an accountability culture; their reliability inspires others.',
      5: 'Universally trusted; the first person sought for the most critical deliverables.',
    },
  },
}

// ─── Score card component ─────────────────────────────────────────────────────

function ScoreCard({
  option, isSelected, desc, onClick,
}: {
  option: typeof SCORE_LABELS[number]
  isSelected: boolean
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 px-4 py-3 transition-all group ${
        isSelected
          ? `${option.activeBg} ring-2 ${option.ring} ring-offset-1`
          : 'bg-white border-gray-150 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
          isSelected ? `${option.activeBg} ${option.color} border-current` : 'border-gray-300 text-gray-400'
        }`}>
          {option.v}
        </span>
        <span className={`font-semibold text-sm ${isSelected ? option.color : 'text-gray-600'}`}>
          {option.label}
        </span>
      </div>
      <p className={`text-xs leading-relaxed pl-7 ${isSelected ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`}>
        {desc}
      </p>
    </button>
  )
}

// ─── Eval form ────────────────────────────────────────────────────────────────

type EmployeeRef = {
  id: string
  fullName: string
  juruId?: string
  grade: string
  position?: string
  team?: { name: string }
}

function EvalForm({
  cycleId, employee, evalType, onDone, cycleLocked,
}: {
  cycleId: string
  employee: EmployeeRef
  evalType: 'EVAL_1' | 'EVAL_2'
  onDone: () => void
  cycleLocked?: boolean
}) {
  const qc = useQueryClient()
  const seniority = getSeniority(employee.grade)

  const { data: existing } = useQuery({
    queryKey: ['eval-sub', cycleId, employee.id, evalType],
    queryFn: () => api.get(`/submissions?cycleId=${cycleId}&employeeId=${employee.id}`).then(r => r.data),
  })
  const sub = existing?.find((s: { type: string }) => s.type === evalType)

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      comment: sub?.comment ?? '',
      scores: Object.fromEntries(
        SUB_CRITERIA.map(sc => [sc.key, sub?.scores?.find((s: { subCriterion: string }) => s.subCriterion === sc.key)?.score ?? 0])
      ),
    },
  })

  const mutation = useMutation({
    mutationFn: (vals: Record<string, unknown>) =>
      api.post('/submissions', {
        cycleId, employeeId: employee.id, type: evalType,
        comment: vals.comment,
        scores: SUB_CRITERIA.map(sc => ({
          subCriterion: sc.key,
          score: Number((vals.scores as Record<string, number>)[sc.key]),
        })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-assignments'] }); onDone() },
  })

  const scores = watch('scores') as Record<string, number>
  const filledCount = Object.values(scores).filter(Boolean).length
  const groups = [...new Set(SUB_CRITERIA.map(s => s.group))]

  if (sub?.status === 'SUBMITTED' || cycleLocked) {
    return (
      <div className={`rounded-xl px-5 py-4 text-sm font-medium ${sub?.status === 'SUBMITTED' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-gray-50 border border-gray-200 text-gray-600'}`}>
        {sub?.status === 'SUBMITTED'
          ? `✓ Evaluation submitted for ${employee.fullName}`
          : `🔒 This cycle is closed — evaluation for ${employee.fullName} can no longer be edited.`}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(vals => mutation.mutate(vals))}>
      {groups.map(group => (
        <Card key={group} className="mb-5">
          <CardHeader>
            <h3 className="font-semibold text-gray-800">{group}</h3>
          </CardHeader>
          <CardBody className="space-y-8">
            {SUB_CRITERIA.filter(sc => sc.group === group).map(sc => (
              <div key={sc.key}>
                <p className="text-sm font-semibold text-gray-800 mb-3">{sc.label}</p>
                <Controller
                  name={`scores.${sc.key}` as const}
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-5 gap-2">
                      {SCORE_LABELS.map(opt => (
                        <ScoreCard
                          key={opt.v}
                          option={opt}
                          isSelected={Number(field.value) === opt.v}
                          desc={RUBRIC[sc.key]?.[seniority]?.[opt.v] ?? ''}
                          onClick={() => field.onChange(opt.v)}
                        />
                      ))}
                    </div>
                  )}
                />
              </div>
            ))}
          </CardBody>
        </Card>
      ))}

      <Card className="mb-4">
        <CardHeader><h3 className="font-semibold text-gray-800">Evaluator Notes</h3></CardHeader>
        <CardBody>
          <Controller
            name="comment"
            control={control}
            render={({ field }) => (
              <textarea
                {...field} rows={4}
                placeholder="Add your evaluation notes, context, or examples to support your scores…"
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C30017] resize-none"
              />
            )}
          />
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{filledCount} / 10 criteria scored</span>
        <Button type="submit" loading={mutation.isPending} disabled={filledCount < 10}>
          Submit Evaluation
        </Button>
      </div>
    </form>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvaluatorPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [selected, setSelected] = useState<{ employeeId: string; evalType: 'EVAL_1' | 'EVAL_2' } | null>(null)
  useEffect(() => { getMe().then(setMe) }, [])

  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => api.get('/cycles').then(r => r.data),
    enabled: !!me,
  })
  const activeCycle = cycles?.find((c: { phase: string }) => c.phase === 'EVALUATION')

  const { data: assignments } = useQuery({
    queryKey: ['my-assignments', activeCycle?.id],
    queryFn: () => api.get(`/assignments?cycleId=${activeCycle.id}`).then(r => r.data),
    enabled: !!activeCycle && !!me,
  })

  const myAssignments = assignments?.filter(
    (a: { evaluator1: { id: string }; evaluator2: { id: string } }) =>
      a.evaluator1?.id === me?.id || a.evaluator2?.id === me?.id
  ) ?? []

  if (!me) return null

  const selEmp = myAssignments.find(
    (a: { employee: EmployeeRef }) => a.employee.id === selected?.employeeId
  )

  return (
    <Shell me={me}>
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Evaluations</h1>
          {activeCycle && (
            <p className="text-sm text-gray-500 mt-1">
              {activeCycle.label} · Due {new Date(activeCycle.evaluationEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>

        {!activeCycle && (
          <Card>
            <CardBody className="text-center py-12 text-gray-400">
              <p className="text-lg font-medium">Evaluation phase is not currently open</p>
              <p className="text-sm mt-1">Check back when the cycle advances to the Evaluation phase.</p>
            </CardBody>
          </Card>
        )}

        {activeCycle && !selected && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold text-gray-800">Assigned Employees ({myAssignments.length})</h2>
            </CardHeader>
            <div className="divide-y divide-gray-100">
              {myAssignments.map((a: {
                employee: EmployeeRef
                evaluator1: { id: string }
                evaluator2: { id: string }
              }) => {
                const evalType = a.evaluator1?.id === me.id ? 'EVAL_1' : 'EVAL_2'
                const weight   = evalType === 'EVAL_1' ? '70%' : '30%'
                return (
                  <div key={a.employee.id} className="flex items-center justify-between px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">{a.employee.fullName}</p>
                      <p className="text-sm text-gray-500">
                        {a.employee.juruId && <span className="font-mono mr-2">{a.employee.juruId}</span>}
                        {a.employee.grade}
                        {a.employee.position && <span className="ml-2 text-gray-400">· {a.employee.position}</span>}
                        <span className="ml-2">· You are Evaluator {evalType === 'EVAL_1' ? '1' : '2'} ({weight})</span>
                      </p>
                    </div>
                    <Button size="sm" onClick={() => setSelected({ employeeId: a.employee.id, evalType })}>
                      Evaluate
                    </Button>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {activeCycle && selected && selEmp && (
          <div>
            <button onClick={() => setSelected(null)} className="text-sm text-[#C30017] mb-5 hover:underline flex items-center gap-1">
              ← Back to list
            </button>

            {/* Employee header */}
            <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selEmp.employee.fullName}</h2>
                <div className="flex items-center gap-3 mt-1.5">
                  {selEmp.employee.juruId && (
                    <span className="font-mono text-sm bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {selEmp.employee.juruId}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded">
                    {selEmp.employee.grade}
                  </span>
                  {selEmp.employee.position && (
                    <span className="text-sm text-gray-500">{selEmp.employee.position}</span>
                  )}
                  {selEmp.employee.team && (
                    <span className="text-sm text-gray-400">· {selEmp.employee.team.name}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {selected.evalType === 'EVAL_1' ? 'Evaluator 1' : 'Evaluator 2'}
                </span>
                <p className="text-2xl font-bold text-[#C30017] mt-0.5">
                  {selected.evalType === 'EVAL_1' ? '70%' : '30%'}
                </p>
                <p className="text-xs text-gray-400">weight</p>
              </div>
            </div>

            <EvalForm
              cycleId={activeCycle.id}
              employee={selEmp.employee}
              evalType={selected.evalType}
              onDone={() => setSelected(null)}
              cycleLocked={!['EVALUATION','CONSOLIDATION'].includes(activeCycle.phase)}
            />
          </div>
        )}
      </div>
    </Shell>
  )
}
