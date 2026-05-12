'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardPath } from '@/lib/auth'

const DEV_ACCOUNTS = [
  { email: 'hr@juru.org',       label: 'HR Admin',   role: 'HR_ADMIN',   desc: 'Manage cycles, employees, reports' },
  { email: 'alice@juru.org',    label: 'Employee',   role: 'EMPLOYEE',   desc: 'Self-appraisal & results (Alice SE1)' },
  { email: 'bob@juru.org',      label: 'Evaluator',  role: 'EVALUATOR',  desc: 'Score assigned employees (Bob PE)' },
  { email: 'teamhead@juru.org', label: 'Team Head',  role: 'TEAM_HEAD',  desc: 'Interview notes & team analytics' },
  { email: 'buhead@juru.org',   label: 'BU Head',    role: 'BU_HEAD',    desc: 'Distribution & nominations (SBU)' },
  { email: 'md@juru.org',       label: 'MD',         role: 'MD',         desc: 'Cross-BU overview & heatmap' },
] as const

const ROLE_COLORS: Record<string, string> = {
  HR_ADMIN:  'bg-purple-100 text-purple-800',
  EMPLOYEE:  'bg-blue-100 text-blue-800',
  EVALUATOR: 'bg-amber-100 text-amber-800',
  TEAM_HEAD: 'bg-green-100 text-green-800',
  BU_HEAD:   'bg-orange-100 text-orange-800',
  MD:        'bg-red-100 text-red-800',
}

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loginAs(email: string, role: string) {
    setLoading(email)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/dev-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Login failed')
      }
      const data = await res.json() as { token: string; role: string }
      localStorage.setItem('juru_token', data.token)
      router.push(dashboardPath(data.role as Parameters<typeof dashboardPath>[0]))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Red header */}
          <div className="bg-[#C30017] px-8 py-8 text-center">
            <img
              src="https://www.juru.org/images/Logo.svg"
              alt="Juru"
              className="h-10 mx-auto"
              style={{ filter: 'brightness(0) invert(1)' }}
            />
          </div>

          <div className="px-8 py-8">
            <h1 className="text-xl font-bold text-gray-900 text-center mb-1">Performance Review</h1>
            <p className="text-sm text-gray-500 text-center mb-6">Choose a role to explore the platform</p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              {DEV_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => loginAs(acc.email, acc.role)}
                  disabled={loading !== null}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:border-[#C30017] hover:bg-red-50 transition-all text-left disabled:opacity-50 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{acc.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[acc.role]}`}>
                        {acc.email.split('@')[0]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{acc.desc}</p>
                  </div>
                  <div className="shrink-0 text-gray-300 group-hover:text-[#C30017] transition-colors">
                    {loading === acc.email ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 pt-5 border-t border-gray-100">
              <button
                onClick={() => { window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google` }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
                </svg>
                Sign in with Google (production)
              </button>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Juru · Performance Review Platform
        </p>
      </div>
    </div>
  )
}
