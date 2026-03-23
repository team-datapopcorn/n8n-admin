import SettingsClient from './settings-client'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">서버 설정</h2>
        <p className="text-muted-foreground text-sm mt-1">
          n8n 서버 연결을 관리합니다
        </p>
      </div>
      <SettingsClient />
    </div>
  )
}
