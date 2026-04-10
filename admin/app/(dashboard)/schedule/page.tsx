import { getServers } from '@/lib/server-config'
import ScheduleClient from './schedule-client'

export const dynamic = 'force-dynamic'

export default function SchedulePage() {
  const servers = getServers()

  if (servers.length === 0) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">스케줄</h2>
        <p className="text-muted-foreground text-sm">
          서버가 설정되지 않았습니다. .env에 서버를 추가하세요.
        </p>
      </div>
    )
  }

  return (
    <ScheduleClient
      servers={servers.map((s) => ({ id: s.id, name: s.name, url: s.url }))}
    />
  )
}
