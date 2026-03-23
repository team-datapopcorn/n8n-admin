'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('My Server')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Redirect to login if not in Electron
  if (typeof window !== 'undefined' && !window.electronAPI?.isElectron) {
    router.replace('/login')
    return null
  }

  async function handleTest() {
    if (!window.electronAPI) return
    setTesting(true)
    setTestResult(null)
    setError('')
    try {
      const result = await window.electronAPI.testConnection(
        url.replace(/\/+$/, ''),
        apiKey
      )
      setTestResult(result.ok ? 'success' : 'error')
      if (!result.ok) setError(result.error ?? '서버 URL 또는 API 키를 확인하세요.')
    } catch {
      setTestResult('error')
      setError('연결 실패: 서버 URL을 확인하세요.')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!window.electronAPI) return
    setSaving(true)
    const server = {
      id: 'server1',
      name: name || 'My Server',
      url: url.replace(/\/+$/, ''),
      apiKey,
    }
    await window.electronAPI.saveServers([server])
    // Electron main process restarts Next.js and reloads the window automatically.
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">n8n Admin 설정</CardTitle>
        <CardDescription>n8n 서버를 연결하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">서버 이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Server"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">서버 URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n.example.com"
            type="url"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">API 키</label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="n8n API 키 입력"
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            n8n → Settings → API → Create API Key에서 발급할 수 있습니다.
          </p>
        </div>

        {testResult === 'success' && (
          <p className="text-sm text-green-600">연결 성공!</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleTest}
            disabled={!url || !apiKey || testing}
          >
            {testing ? '테스트 중...' : '연결 테스트'}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!url || !apiKey || saving}
          >
            {saving ? '저장 중...' : '저장 후 시작'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
