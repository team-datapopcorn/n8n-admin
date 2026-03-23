import ServerHealthCard from '@/components/dashboard/server-health-card'
import { getServers } from '@/lib/server-config'

export default function DashboardPage() {
  const servers = getServers()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">대시보드</h2>
        <p className="text-muted-foreground text-sm mt-1">서버 상태 · 60초마다 자동 갱신</p>
      </div>
      {servers.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {process.env.ELECTRON_CONFIG_PATH
            ? '설정에서 서버를 추가하면 상태가 표시됩니다.'
            : '.env에 SERVER_URL과 SERVER_API_KEY를 입력하면 서버 상태가 표시됩니다.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {servers.map((s) => (
            <ServerHealthCard key={s.id} serverId={s.id} />
          ))}
        </div>
      )}
    </div>
  )
}
