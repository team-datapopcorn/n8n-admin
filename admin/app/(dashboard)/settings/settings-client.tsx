'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus, Play, CheckCircle, AlertCircle, Loader2, Save } from 'lucide-react'
import type { ElectronServer } from '@/lib/electron'

interface CleanupResult {
  renamed: { id: string; oldName: string; newName: string; method: 'ai' | 'normalize' }[]
  skipped: { id: string; name: string; reason: string }[]
  credentialWarnings: { id: string; name: string; type: string }[]
  errors: { id: string; name: string; error: string }[]
}

export default function SettingsClient() {
  const [servers, setServers] = useState<ElectronServer[]>([])
  const [saving, setSaving] = useState(false)

  // Gemini 키 상태
  const [geminiConfigured, setGeminiConfigured] = useState(false)
  const [geminiSource, setGeminiSource] = useState<'env' | 'config' | null>(null)
  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [geminiSaving, setGeminiSaving] = useState(false)
  const [geminiSaveError, setGeminiSaveError] = useState<string | null>(null)
  const [geminiSaveOk, setGeminiSaveOk] = useState(false)

  // AI 자동 정리 상태
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  useEffect(() => {
    // 서버 목록 (Electron)
    if (window.electronAPI) {
      window.electronAPI.getServers().then(setServers)
    }
    // Gemini 설정 상태
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        setGeminiConfigured(d.geminiConfigured ?? false)
        setGeminiSource(d.geminiSource ?? null)
      })
      .catch(() => {})
  }, [])

  async function saveGeminiKey() {
    if (!geminiKeyInput.trim()) return
    setGeminiSaving(true)
    setGeminiSaveError(null)
    setGeminiSaveOk(false)
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geminiApiKey: geminiKeyInput }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGeminiSaveError(data.error ?? '저장 실패')
      } else {
        setGeminiConfigured(true)
        setGeminiSource('config')
        setGeminiKeyInput('')
        setGeminiSaveOk(true)
        setTimeout(() => setGeminiSaveOk(false), 3000)
      }
    } catch (err) {
      setGeminiSaveError(String(err))
    } finally {
      setGeminiSaving(false)
    }
  }

  async function runCleanup() {
    setCleanupRunning(true)
    setCleanupResult(null)
    setCleanupError(null)
    try {
      const res = await fetch('/api/auto-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: 'server1' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCleanupError(data.error ?? '알 수 없는 오류')
      } else {
        setCleanupResult(data)
      }
    } catch (err) {
      setCleanupError(String(err))
    } finally {
      setCleanupRunning(false)
    }
  }

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
  }

  return (
    <div className="space-y-6">
      {/* ── AI 자동 정리 ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI 자동 정리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Gemini 키 상태 */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Gemini API 키</span>
            {geminiConfigured ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                설정됨{geminiSource === 'env' ? ' (환경변수)' : ''}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                미설정
              </Badge>
            )}
          </div>

          {/* 키 입력 (env에서 읽히면 숨김) */}
          {geminiSource !== 'env' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                {geminiConfigured ? 'Gemini API 키 변경' : 'Gemini API 키 입력'}
              </label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveGeminiKey()}
                />
                <Button
                  size="sm"
                  onClick={saveGeminiKey}
                  disabled={geminiSaving || !geminiKeyInput.trim()}
                  className="gap-1 shrink-0"
                >
                  {geminiSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  저장
                </Button>
              </div>
              {geminiSaveError && (
                <p className="text-xs text-destructive">{geminiSaveError}</p>
              )}
              {geminiSaveOk && (
                <p className="text-xs text-green-600">저장되었습니다.</p>
              )}
              <p className="text-xs text-muted-foreground">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Google AI Studio
                </a>
                에서 무료로 발급 · gemini-2.0-flash 사용
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            기본 이름 워크플로우(workflow, My workflow)는 AI가 노드 내용으로 이름을 제안하고,
            복사/버전 마커((copy), v1, mk2)는 자동 정규화됩니다.
            매일 03:00 KST 자동 실행됩니다.
          </p>

          <Button
            onClick={runCleanup}
            disabled={cleanupRunning || !geminiConfigured}
            size="sm"
            className="gap-2"
          >
            {cleanupRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                실행 중...
              </>
            ) : (
              <>
                <Play size={14} />
                지금 실행
              </>
            )}
          </Button>

          {cleanupError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{cleanupError}</span>
            </div>
          )}

          {cleanupResult && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle size={14} className="text-green-600" />
                정리 완료
              </div>
              <div className="text-muted-foreground space-y-1">
                <p>이름 변경: {cleanupResult.renamed.length}개</p>
                {cleanupResult.renamed.length > 0 && (
                  <ul className="ml-3 space-y-0.5">
                    {cleanupResult.renamed.map((r) => (
                      <li key={r.id}>
                        <span className="line-through text-muted-foreground/60">{r.oldName}</span>
                        {' → '}
                        <span className="text-foreground">{r.newName}</span>
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          ({r.method === 'ai' ? 'AI' : '정규화'})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {cleanupResult.credentialWarnings.length > 0 && (
                  <p className="text-yellow-600">
                    크레덴셜 이상 이름: {cleanupResult.credentialWarnings.length}개
                    {' ('}
                    {cleanupResult.credentialWarnings.map((c) => c.name).join(', ')}
                    {')'}
                  </p>
                )}
                {cleanupResult.errors.length > 0 && (
                  <p className="text-destructive">오류: {cleanupResult.errors.length}개</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── 서버 설정 (Electron 전용) ───────────────── */}
      {typeof window !== 'undefined' && window.electronAPI?.isElectron ? (
        <>
          {servers.map((server, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{server.name || `서버 ${i + 1}`}</CardTitle>
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
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          서버 연결 설정은 데스크톱 앱에서만 관리할 수 있습니다.
          웹 배포에서는 .env 파일을 직접 편집하세요.
        </p>
      )}
    </div>
  )
}
