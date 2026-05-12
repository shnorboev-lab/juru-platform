'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { Bell, LogOut, BarChart2, Users, ClipboardList, Home, FileText, CheckSquare } from 'lucide-react'
import type { Me } from '@/lib/auth'
import { logout } from '@/lib/auth'
import Image from 'next/image'

interface NavItem { href: string; label: string; icon: React.ReactNode }

function navItems(role: string): NavItem[] {
  const all: Record<string, NavItem[]> = {
    EMPLOYEE: [
      { href: '/employee',              label: 'Notifications', icon: <Bell size={16} /> },
    ],
    EVALUATOR: [
      { href: '/evaluator',             label: 'Evaluations',   icon: <CheckSquare size={16} /> },
      { href: '/notifications',         label: 'Notifications', icon: <Bell size={16} /> },
    ],
    HR_ADMIN: [
      { href: '/hr',               label: 'Admin Panel',    icon: <ClipboardList size={16} /> },
      { href: '/hr/employees',     label: 'Employees',      icon: <Users size={16} /> },
      { href: '/analytics',        label: 'Analytics',      icon: <BarChart2 size={16} /> },
      { href: '/analytics/staff',  label: 'Staff Progress', icon: <Users size={16} /> },
      { href: '/hr/reports',       label: 'Reports',        icon: <FileText size={16} /> },
      { href: '/notifications',    label: 'Notifications',  icon: <Bell size={16} /> },
    ],
    TEAM_HEAD: [
      { href: '/analytics/staff',       label: 'Staff Progress',icon: <Users size={16} /> },
      { href: '/analytics',             label: 'Analytics',     icon: <BarChart2 size={16} /> },
      { href: '/analytics/interviews',  label: 'Interviews',    icon: <CheckSquare size={16} /> },
      { href: '/notifications',         label: 'Notifications', icon: <Bell size={16} /> },
    ],
    BU_HEAD: [
      { href: '/analytics/staff',       label: 'Staff Progress',icon: <Users size={16} /> },
      { href: '/analytics',             label: 'Analytics',     icon: <BarChart2 size={16} /> },
      { href: '/hr/reports',            label: 'Reports',       icon: <FileText size={16} /> },
      { href: '/notifications',         label: 'Notifications', icon: <Bell size={16} /> },
    ],
    MD: [
      { href: '/analytics/staff',       label: 'Staff Progress',icon: <Users size={16} /> },
      { href: '/analytics',             label: 'Analytics',     icon: <BarChart2 size={16} /> },
      { href: '/notifications',         label: 'Notifications', icon: <Bell size={16} /> },
    ],
  }
  return all[role] ?? all['EMPLOYEE']
}

export function Shell({ me, children }: { me: Me; children: React.ReactNode }) {
  const pathname = usePathname()
  const items    = navItems(me.role)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <img src="https://www.juru.org/images/Logo.svg" alt="Juru" className="h-7" />
          <span className="ml-3 text-xs font-semibold text-gray-500 tracking-widest uppercase">Performance</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {items.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors',
                (pathname === item.href || pathname.startsWith(item.href + '/')) && item.href !== '/'
                  ? 'bg-[#f5e6e9] text-[#C30017] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{me.fullName}</p>
              <p className="text-xs text-gray-500 truncate">{me.grade} · {me.role.replace('_',' ')}</p>
            </div>
            <button onClick={logout} title="Sign out" className="text-gray-400 hover:text-red-600 ml-2">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
