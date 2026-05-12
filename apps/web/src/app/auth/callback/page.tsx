'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { dashboardPath } from '@/lib/auth'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token  = params.get('token')
    const role   = params.get('role') as Parameters<typeof dashboardPath>[0] | null

    if (token && role) {
      localStorage.setItem('juru_token', token)
      router.replace(dashboardPath(role))
    } else {
      router.replace('/login?error=auth')
    }
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-[#C30017]" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  )
}
