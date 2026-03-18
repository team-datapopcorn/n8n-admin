import Sidebar from '@/components/layout/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // process.env는 Server Component에서만 접근 가능합니다.
  // GCP_PROJECT_ID가 설정되어 있을 때만 GCP 탭을 표시합니다.
  const showGcp = !!process.env.GCP_PROJECT_ID

  return (
    <div className="flex min-h-screen">
      <Sidebar showGcp={showGcp} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
