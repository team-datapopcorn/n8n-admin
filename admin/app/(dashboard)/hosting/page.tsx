import { getServers } from '@/lib/server-config'
import HostingClient from './hosting-client'

export const dynamic = 'force-dynamic'

export default function HostingPage() {
  const servers = getServers()
  const hostingServers = servers
    .filter((s) => s.hosting)
    .map((s) => ({ id: s.id, name: s.name, hostingType: s.hosting!.type }))

  if (hostingServers.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">인프라 관리</h2>
        <p className="text-muted-foreground text-sm">
          호스팅이 설정된 서버가 없습니다. .env에 SERVER_HOSTING을 추가하세요.
        </p>
      </div>
    )
  }

  return <HostingClient servers={hostingServers} />
}
