'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Step = 'welcome' | 'url' | 'apikey' | 'done'

interface SetupWizardProps {
  onComplete: (server: { name: string; url: string; apiKey: string }) => void
  onDemoMode: () => void
}

export function SetupWizard({ onComplete, onDemoMode }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [serverName, setServerName] = useState('My Server')
  const [urlTested, setUrlTested] = useState(false)
  const [apiKeyTested, setApiKeyTested] = useState(false)
  const [urlStatus, setUrlStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [urlMessage, setUrlMessage] = useState('')
  const [apiKeyStatus, setApiKeyStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [apiKeyMessage, setApiKeyMessage] = useState('')

  async function handleTestUrl() {
    if (!url) return
    setUrlStatus('testing')
    setUrlMessage('')
    const cleanUrl = url.replace(/\/+$/, '')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${cleanUrl}/api/v1/workflows?limit=1`, {
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok || res.status === 401) {
        // 401 means the server exists but needs auth — URL is valid
        setUrlStatus('ok')
        setUrlMessage('서버에 연결되었습니다.')
        setUrlTested(true)
      } else {
        setUrlStatus('error')
        setUrlMessage(`서버 응답 오류: ${res.status}. URL을 확인하세요.`)
      }
    } catch {
      setUrlStatus('error')
      setUrlMessage('서버에 연결할 수 없습니다. URL을 확인하세요.')
    }
  }

  async function handleTestApiKey() {
    if (!apiKey) return
    setApiKeyStatus('testing')
    setApiKeyMessage('')
    const cleanUrl = url.replace(/\/+$/, '')
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(`${cleanUrl}/api/v1/workflows?limit=1`, {
        headers: { 'X-N8N-API-KEY': apiKey },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (res.ok) {
        setApiKeyStatus('ok')
        setApiKeyMessage('API 키가 확인되었습니다.')
        setApiKeyTested(true)
      } else if (res.status === 401) {
        setApiKeyStatus('error')
        setApiKeyMessage('API 키가 올바르지 않습니다. n8n → Settings → API에서 키를 확인해주세요.')
      } else {
        setApiKeyStatus('error')
        setApiKeyMessage(`응답 오류: ${res.status}. API 키를 확인하세요.`)
      }
    } catch {
      setApiKeyStatus('error')
      setApiKeyMessage('서버에 연결할 수 없습니다.')
    }
  }

  if (step === 'welcome') {
    return (
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold">n8n Admin에 오신 것을 환영합니다!</h1>
          <p className="text-muted-foreground">n8n 서버를 연결하거나 데모 모드로 둘러보세요.</p>
        </div>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={() => setStep('url')}>
            서버 연결하기
          </Button>
          <Button size="lg" variant="outline" onClick={onDemoMode}>
            서버 없이 둘러보기
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'url') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Step 1/3</p>
          <h2 className="text-2xl font-bold">n8n 서버 주소</h2>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">서버 URL</label>
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setUrlTested(false)
              setUrlStatus('idle')
              setUrlMessage('')
            }}
            placeholder="https://n8n.example.com"
            type="url"
          />
        </div>
        {urlStatus === 'ok' && (
          <p className="text-sm text-green-600">{urlMessage}</p>
        )}
        {urlStatus === 'error' && (
          <p className="text-sm text-destructive">{urlMessage}</p>
        )}
        <Button
          variant="outline"
          onClick={handleTestUrl}
          disabled={!url || urlStatus === 'testing'}
          className="w-full"
        >
          {urlStatus === 'testing' ? '테스트 중...' : '연결 테스트'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setStep('welcome')}>
            이전
          </Button>
          {urlTested && (
            <Button className="flex-1" onClick={() => setStep('apikey')}>
              다음
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'apikey') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Step 2/3</p>
          <h2 className="text-2xl font-bold">API 키</h2>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">API 키</label>
          <Input
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setApiKeyTested(false)
              setApiKeyStatus('idle')
              setApiKeyMessage('')
            }}
            placeholder="n8n API 키 입력"
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            n8n → Settings → API → Create API Key에서 발급할 수 있습니다.
          </p>
        </div>
        {apiKeyStatus === 'ok' && (
          <p className="text-sm text-green-600">{apiKeyMessage}</p>
        )}
        {apiKeyStatus === 'error' && (
          <p className="text-sm text-destructive">{apiKeyMessage}</p>
        )}
        <Button
          variant="outline"
          onClick={handleTestApiKey}
          disabled={!apiKey || apiKeyStatus === 'testing'}
          className="w-full"
        >
          {apiKeyStatus === 'testing' ? '확인 중...' : 'API 키 확인'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setStep('url')}>
            이전
          </Button>
          {apiKeyTested && (
            <Button className="flex-1" onClick={() => setStep('done')}>
              다음
            </Button>
          )}
        </div>
      </div>
    )
  }

  // done step
  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Step 3/3</p>
        <h2 className="text-2xl font-bold">설정 완료!</h2>
        <p className="text-muted-foreground">서버 이름을 입력하고 대시보드로 이동하세요.</p>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">서버 이름</label>
        <Input
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          placeholder="My Server"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setStep('apikey')}>
          이전
        </Button>
        <Button
          className="flex-1"
          onClick={() =>
            onComplete({
              name: serverName || 'My Server',
              url: url.replace(/\/+$/, ''),
              apiKey,
            })
          }
        >
          대시보드로 이동
        </Button>
      </div>
    </div>
  )
}
