import SettingsClient from './settings-client'
import { getServers } from '@/lib/server-config'

export const dynamic = 'force-dynamic'

export default function SettingsPage() {
  const servers = getServers().map((s) => ({ id: s.id, name: s.name }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">설정</h2>
        <p className="text-muted-foreground text-sm mt-1">
          n8n Admin 대시보드 설정을 관리합니다
        </p>
      </div>
      <SettingsClient servers={servers} />
    </div>
  )
}
