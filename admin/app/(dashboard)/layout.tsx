import Sidebar from '@/components/layout/sidebar'
import { DemoProvider } from '@/lib/demo-context'
import { DemoBanner } from '@/components/demo-banner'
import { getServers } from '@/lib/server-config'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // process.env는 Server Component에서만 접근 가능합니다.
  // 호스팅이 설정된 서버가 있을 때만 인프라 탭을 표시합니다.
  const showHosting = getServers().some((s) => s.hosting)

  return (
    <DemoProvider>
      <div className="flex min-h-screen">
        <Sidebar showHosting={showHosting} />
        <main className="flex-1 overflow-auto">
          <div className="h-8 [-webkit-app-region:drag]" />
          <DemoBanner />
          <div className="px-6 pb-6">{children}</div>
        </main>
      </div>
    </DemoProvider>
  )
}
