'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'
import type { ElectronServer } from '@/lib/electron'

export default function SettingsClient() {
  const [servers, setServers] = useState<ElectronServer[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServers().then(setServers)
    }
  }, [])

  function addServer() {
    const nextId = `server${servers.length + 1}`
    setServers([...servers, { id: nextId, name: '', url: '', apiKey: '' }])
  }

  function updateServer(index: number, field: keyof ElectronServer, value: string) {
    const updated = [...servers]
    updated[index] = { ...updated[index], [field]: value }
    setServers(updated)
  }

  function removeServer(index: number) {
    setServers(servers.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!window.electronAPI) return
    setSaving(true)
    const normalized = servers.map((s, i) => ({
      ...s,
      id: `server${i + 1}`,
      url: s.url.replace(/\/+$/, ''),
    }))
    await window.electronAPI.saveServers(normalized)
    // Electron will restart the app
  }

  if (typeof window === 'undefined' || !window.electronAPI?.isElectron) {
    return (
      <p className="text-muted-foreground text-sm">
        이 설정은 데스크톱 앱에서만 사용할 수 있습니다.
        웹 배포에서는 .env 파일을 직접 편집하세요.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {servers.map((server, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">서버 {i + 1}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeServer(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={16} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">이름</label>
              <Input
                value={server.name}
                onChange={(e) => updateServer(i, 'name', e.target.value)}
                placeholder="My Server"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">URL</label>
              <Input
                value={server.url}
                onChange={(e) => updateServer(i, 'url', e.target.value)}
                placeholder="https://n8n.example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">API 키</label>
              <Input
                value={server.apiKey}
                onChange={(e) => updateServer(i, 'apiKey', e.target.value)}
                placeholder="API 키"
                type="password"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" onClick={addServer} className="gap-2">
          <Plus size={16} />
          서버 추가
        </Button>
        <Button onClick={handleSave} disabled={saving || servers.length === 0}>
          {saving ? '저장 중...' : '저장 후 적용'}
        </Button>
      </div>
    </div>
  )
}
