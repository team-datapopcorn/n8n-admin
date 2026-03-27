import Sidebar from '@/components/layout/sidebar'
import { DemoProvider } from '@/lib/demo-context'
import { DemoBanner } from '@/components/demo-banner'

export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // process.env는 Server Component에서만 접근 가능합니다.
  // GCP_PROJECT_ID가 설정되어 있을 때만 GCP 탭을 표시합니다.
  const showGcp = !!process.env.GCP_PROJECT_ID
  const showSettings = !!process.env.ELECTRON_CONFIG_PATH

  return (
    <DemoProvider>
      <div className="flex min-h-screen">
        <Sidebar showGcp={showGcp} showSettings={showSettings} />
        <main className="flex-1 overflow-auto">
          <div className="h-8 [-webkit-app-region:drag]" />
          <DemoBanner />
          <div className="px-6 pb-6">{children}</div>
        </main>
      </div>
    </DemoProvider>
  )
}
