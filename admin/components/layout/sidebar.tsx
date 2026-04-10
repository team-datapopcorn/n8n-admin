'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { LayoutDashboard, Workflow, Users, Key, Server, Settings, LogOut, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const BASE_NAV = [
  { href: '/',            label: '대시보드',   icon: LayoutDashboard },
  { href: '/workflows',   label: '워크플로우', icon: Workflow },
  { href: '/users',       label: '유저',       icon: Users },
  { href: '/credentials', label: '크레덴셜',   icon: Key },
]

const SCHEDULE_NAV = { href: '/schedule', label: '스케줄', icon: Calendar }
const HOSTING_NAV = { href: '/hosting', label: '인프라', icon: Server }

const SETTINGS_NAV = { href: '/settings', label: '설정', icon: Settings }

interface SidebarProps {
  showHosting: boolean
}

export default function Sidebar({ showHosting }: SidebarProps) {
  const pathname = usePathname()
  const nav = [...BASE_NAV, SCHEDULE_NAV]
  if (showHosting) nav.push(HOSTING_NAV)
  nav.push(SETTINGS_NAV)

  return (
    <aside className="flex flex-col w-56 min-h-screen border-r bg-background px-3 py-4">
      {/* macOS 트래픽 라이트 + 윈도우 드래그 영역 */}
      <div className="mb-2 h-8 [-webkit-app-region:drag]" />
      <div className="mb-6 px-2">
        <h1 className="font-bold text-lg">n8n Admin</h1>
      </div>

      <nav className="flex-1 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <Button
        variant="ghost"
        size="sm"
        className="justify-start gap-3 text-muted-foreground"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        <LogOut size={16} />
        로그아웃
      </Button>
    </aside>
  )
}
