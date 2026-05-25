import { api } from './api'

export type Role = 'EMPLOYEE' | 'EVALUATOR' | 'HR_ADMIN' | 'TEAM_HEAD' | 'BU_HEAD' | 'MD'

export interface Me {
  id: string
  fullName: string
  email: string
  grade: string
  role: Role
  teamId?: string
  buId?:   string
  team?: { id: string; name: string }
  bu?:   { id: string; name: string }
}

export async function getMe(): Promise<Me | null> {
  try {
    const { data } = await api.get<Me>('/auth/me')
    return data
  } catch {
    return null
  }
}

export function loginWithGoogle() {
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/google`
}

export function logout() {
  localStorage.removeItem('juru_token')
  window.location.href = '/login'
}

export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    EMPLOYEE:   'Employee',
    EVALUATOR:  'Evaluator',
    HR_ADMIN:   'HR Admin',
    TEAM_HEAD:  'Team Head',
    BU_HEAD:    'BU Head',
    MD:         'MD',
  }
  return map[role] ?? role
}

export function dashboardPath(role: Role): string {
  if (role === 'HR_ADMIN')   return '/hr/self-appraisals'
  if (role === 'EVALUATOR')  return '/evaluator'
  if (role === 'TEAM_HEAD')  return '/team/self-appraisals'
  if (['BU_HEAD','MD'].includes(role)) return '/analytics'
  return '/employee/self-appraisals'
}
