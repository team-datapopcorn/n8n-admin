'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Trash2, Plus, Play, CheckCircle, AlertCircle, Loader2, Save,
  Key, Clock, Bell, Shield, Sparkles, Server,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── 타입 ──────────────────────────────────────────────────────

interface ConfigState {
  isVercel: boolean
  geminiConfigured: boolean
  geminiSource: 'env' | 'config' | null
  cronSecretConfigured: boolean
  cronSecretSource: 'env' | 'config' | null
  slackConfigured: boolean
  slackSource: 'env' | 'config' | null
  cleanupTime: string
  cleanupServerId?: string
  namingConventionEnabled: boolean
  staleDays: number
  dormantDays: number
  servers: { id: string; name: string }[]
}

interface CleanupResult {
  renamed: { id: string; oldName: string; newName: string; method: 'ai' | 'normalize' }[]
  skipped: { id: string; name: string; reason: string }[]
  credentialWarnings: { id: string; name: string; type: string }[]
  errors: { id: string; name: string; error: string }[]
}

// ─── 키 입력 컴포넌트 ──────────────────────────────────────────

function SecretInput({
  label,
  placeholder,
  configured,
  source,
  helpText,
  helpUrl,
  onSave,
  isVercel,
}: {
  label: string
  placeholder: string
  configured: boolean
  source: 'env' | 'config' | null
  helpText?: string
  helpUrl?: string
  onSave: (value: string) => Promise<void>
  isVercel?: boolean
}) {
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setValue('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      toast.error('저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        {configured ? (
          <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
            설정됨{source === 'env' ? ' (환경변수)' : ''}
          </Badge>
        ) : (
          <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
            미설정
          </Badge>
        )}
      </div>
      {source !== 'env' && (
        isVercel ? (
          <p className="text-xs text-blue-600">
            Vercel 대시보드 → Settings → Environment Variables에서 설정해주세요.
          </p>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button size="sm" onClick={handleSave} disabled={saving || !value.trim()} className="gap-1 shrink-0">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                저장
              </Button>
            </div>
            {saved && <p className="text-xs text-green-600">저장되었습니다.</p>}
          </>
        )
      )}
      {helpText && (
        <p className="text-xs text-muted-foreground">
          {helpUrl ? (
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {helpText}
            </a>
          ) : helpText}
        </p>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ─────────────────────────────────────────────

export default function SettingsClient({ servers }: { servers: { id: string; name: string }[] }) {
  const [config, setConfig] = useState<ConfigState | null>(null)
  const [loading, setLoading] = useState(true)

  // 자동 정리 상태
  const [cleanupRunning, setCleanupRunning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [cleanupServerId, setCleanupServerId] = useState('')

  // Electron 서버 관리
  const [electronServers, setElectronServers] = useState<{ id: string; name: string; url: string; apiKey: string }[]>([])
  const [electronSaving, setElectronSaving] = useState(false)
  const isElectron = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((d) => {
        setConfig(d)
        setCleanupServerId(d.cleanupServerId || (d.servers[0]?.id ?? ''))
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    if (isElectron) {
      (window as unknown as { electronAPI: { getServers: () => Promise<typeof electronServers> } })
        .electronAPI.getServers().then(setElectronServers)
    }
  }, [])

  async function saveConfig(updates: Record<string, unknown>) {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      if (data.vercel) {
        toast.error('Vercel 환경에서는 Vercel 대시보드 → Settings → Environment Variables에서 설정해주세요.')
      }
      throw new Error(data.error || '저장 실패')
    }
    // 상태 리프레시
    const d = await fetch('/api/config').then((r) => r.json())
    setConfig(d)
  }

  async function runCleanup(dryRun: boolean) {
    setCleanupRunning(true)
    setCleanupResult(null)
    setCleanupError(null)
    try {
      const res = await fetch('/api/auto-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: cleanupServerId, dryRun }),
      })
      const data = await res.json()
      if (!res.ok) {
        setCleanupError(data.error ?? '알 수 없는 오류')
      } else {
        setCleanupResult(data)
        if (!dryRun) toast.success('자동 정리 완료')
      }
    } catch (err) {
      setCleanupError(String(err))
    } finally {
      setCleanupRunning(false)
    }
  }

  if (loading) return <div className="text-muted-foreground text-sm">설정 불러오는 중...</div>
  if (!config) return <div className="text-destructive text-sm">설정을 불러올 수 없습니다.</div>

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Vercel 환경 안내 ─────────────────────────────── */}
      {config.isVercel && (
        <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 p-4 text-sm space-y-1">
          <p className="font-medium text-blue-800 dark:text-blue-300">Vercel 클라우드 배포 환경</p>
          <p className="text-blue-700 dark:text-blue-400">
            설정값은 <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 font-medium">Vercel 대시보드</a> → 프로젝트 → Settings → Environment Variables에서 관리해주세요.
            환경변수로 설정된 값은 아래에 &quot;설정됨 (환경변수)&quot;로 표시됩니다.
          </p>
        </div>
      )}

      {/* ── API 키 관리 ───────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Key size={16} /> API 키</CardTitle>
          <CardDescription>외부 서비스 연동에 필요한 API 키를 관리합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SecretInput
            label="Gemini API 키"
            placeholder="AIza..."
            configured={config.geminiConfigured}
            source={config.geminiSource}
            helpText="Google AI Studio에서 무료 발급 · gemini-2.0-flash"
            helpUrl="https://aistudio.google.com/app/apikey"
            isVercel={config.isVercel}
            onSave={async (v) => {
              await saveConfig({ geminiApiKey: v })
              toast.success('Gemini API 키 저장됨')
            }}
          />

          <SecretInput
            label="Slack Webhook URL"
            placeholder="https://hooks.slack.com/services/..."
            configured={config.slackConfigured}
            source={config.slackSource}
            helpText="자동 정리 결과, 에러 알림 등을 Slack으로 받습니다"
            isVercel={config.isVercel}
            onSave={async (v) => {
              await saveConfig({ slackWebhookUrl: v })
              toast.success('Slack Webhook 저장됨')
            }}
          />

          <SecretInput
            label="Cron 인증 시크릿"
            placeholder="openssl rand -base64 32"
            configured={config.cronSecretConfigured}
            source={config.cronSecretSource}
            helpText="Vercel Cron 엔드포인트 인증용 시크릿"
            isVercel={config.isVercel}
            onSave={async (v) => {
              await saveConfig({ cronSecret: v })
              toast.success('Cron 시크릿 저장됨')
            }}
          />
        </CardContent>
      </Card>

      {/* ── 자동 정리 설정 ─────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Sparkles size={16} /> AI 자동 정리</CardTitle>
          <CardDescription>워크플로우 이름 정규화 및 AI 이름 제안 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">네이밍 컨벤션 검사</p>
              <p className="text-xs text-muted-foreground">[프로젝트명] 기능 설명 형식 검사</p>
            </div>
            <Switch
              checked={config.namingConventionEnabled}
              onCheckedChange={async (v) => {
                await saveConfig({ namingConventionEnabled: v })
                toast.success(v ? '네이밍 컨벤션 활성화' : '네이밍 컨벤션 비활성화')
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">대상 서버</label>
              <Select
                value={cleanupServerId}
                onValueChange={(v) => {
                  if (v) {
                    setCleanupServerId(v)
                    saveConfig({ cleanupServerId: v })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {servers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">실행 시간 (KST)</label>
              <Input
                value={config.cleanupTime}
                onChange={async (e) => {
                  const v = e.target.value
                  setConfig({ ...config, cleanupTime: v })
                }}
                onBlur={async (e) => {
                  await saveConfig({ cleanupTime: e.target.value })
                }}
                placeholder="03:00"
              />
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            기본 이름(workflow, My workflow)은 AI가 노드 내용으로 이름을 제안하고,
            복사/버전 마커((copy), v1, mk2)는 자동 정규화됩니다.
          </p>

          <div className="flex gap-2">
            <Button
              onClick={() => runCleanup(true)}
              disabled={cleanupRunning || !config.geminiConfigured}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              {cleanupRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              미리보기 (Dry Run)
            </Button>
            <Button
              onClick={() => runCleanup(false)}
              disabled={cleanupRunning || !config.geminiConfigured}
              size="sm"
              className="gap-2"
            >
              {cleanupRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              지금 실행
            </Button>
          </div>

          {!config.geminiConfigured && (
            <p className="text-xs text-yellow-600">Gemini API 키를 먼저 설정하세요.</p>
          )}

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
                {cleanupResult.renamed.length > 0 ? '정리 결과' : '변경할 항목 없음'}
              </div>
              <div className="text-muted-foreground space-y-1">
                <p>이름 변경: {cleanupResult.renamed.length}개</p>
                {cleanupResult.renamed.length > 0 && (
                  <ul className="ml-3 space-y-0.5">
                    {cleanupResult.renamed.slice(0, 10).map((r) => (
                      <li key={r.id}>
                        <span className="line-through text-muted-foreground/60">{r.oldName}</span>
                        {' → '}
                        <span className="text-foreground">{r.newName}</span>
                        <span className="ml-1 text-xs text-muted-foreground/60">
                          ({r.method === 'ai' ? 'AI' : '정규화'})
                        </span>
                      </li>
                    ))}
                    {cleanupResult.renamed.length > 10 && (
                      <li className="text-muted-foreground/60">... 외 {cleanupResult.renamed.length - 10}개</li>
                    )}
                  </ul>
                )}
                {cleanupResult.credentialWarnings.length > 0 && (
                  <p className="text-yellow-600">
                    크레덴셜 이상 이름: {cleanupResult.credentialWarnings.length}개
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

      {/* ── 모니터링 기준 설정 ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Clock size={16} /> 모니터링 기준</CardTitle>
          <CardDescription>스케줄 페이지의 점검 기준값을 설정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">비활성 워크플로우 기준</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.staleDays}
                  onChange={(e) => setConfig({ ...config, staleDays: Number(e.target.value) })}
                  onBlur={async (e) => {
                    await saveConfig({ staleDays: Number(e.target.value) })
                    toast.success('저장됨')
                  }}
                  className="w-20"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">일 이상 미사용</span>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">휴면 유저 기준</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.dormantDays}
                  onChange={(e) => setConfig({ ...config, dormantDays: Number(e.target.value) })}
                  onBlur={async (e) => {
                    await saveConfig({ dormantDays: Number(e.target.value) })
                    toast.success('저장됨')
                  }}
                  className="w-20"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">일 이상 미접속</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── 서버 연결 정보 ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server size={16} /> 서버 연결</CardTitle>
          <CardDescription>현재 연결된 n8n 서버 목록</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isElectron ? (
            <>
              {electronServers.map((server, i) => (
                <div key={i} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{server.name || `서버 ${i + 1}`}</span>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setElectronServers(electronServers.filter((_, idx) => idx !== i))}
                      className="text-muted-foreground hover:text-destructive h-7 w-7"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    <Input
                      value={server.name}
                      onChange={(e) => {
                        const u = [...electronServers]; u[i] = { ...u[i], name: e.target.value }; setElectronServers(u)
                      }}
                      placeholder="서버 이름"
                    />
                    <Input
                      value={server.url}
                      onChange={(e) => {
                        const u = [...electronServers]; u[i] = { ...u[i], url: e.target.value }; setElectronServers(u)
                      }}
                      placeholder="https://n8n.example.com"
                    />
                    <Input
                      type="password"
                      value={server.apiKey}
                      onChange={(e) => {
                        const u = [...electronServers]; u[i] = { ...u[i], apiKey: e.target.value }; setElectronServers(u)
                      }}
                      placeholder="API 키"
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setElectronServers([...electronServers, { id: `server${electronServers.length + 1}`, name: '', url: '', apiKey: '' }])
                }} className="gap-1">
                  <Plus size={14} /> 서버 추가
                </Button>
                <Button size="sm" disabled={electronSaving} onClick={async () => {
                  setElectronSaving(true)
                  const api = (window as unknown as { electronAPI: { saveServers: (s: typeof electronServers) => Promise<void> } }).electronAPI
                  await api.saveServers(electronServers.map((s, i) => ({ ...s, id: `server${i + 1}`, url: s.url.replace(/\/+$/, '') })))
                  toast.success('서버 설정 저장됨')
                  setElectronSaving(false)
                }}>
                  {electronSaving ? '저장 중...' : '저장 후 적용'}
                </Button>
              </div>
            </>
          ) : (
            <>
              {servers.length > 0 ? (
                <div className="space-y-2">
                  {servers.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="font-mono text-xs">{s.id}</Badge>
                      <span>{s.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">연결된 서버가 없습니다.</p>
              )}
              <p className="text-xs text-muted-foreground">
                웹 환경에서는 .env 파일의 SERVER_URL, SERVER_API_KEY로 서버를 관리합니다.
                데스크톱 앱에서는 UI로 직접 편집할 수 있습니다.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Claude Code 연결 ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Shield size={16} /> Claude Code 연결</CardTitle>
          <CardDescription>자연어로 n8n을 관리할 수 있습니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-sm font-medium">1. 설치</p>
              <code className="block bg-muted px-3 py-2 rounded text-xs font-mono">
                npm install -g @anthropic-ai/claude-code
              </code>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">2. 실행</p>
              <code className="block bg-muted px-3 py-2 rounded text-xs font-mono">
                cd n8n-admin && claude
              </code>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">3. 사용 예시</p>
              <ul className="text-sm text-muted-foreground space-y-1 ml-1">
                <li>&bull; &quot;워크플로우 목록 보여줘&quot;</li>
                <li>&bull; &quot;Slack 알림 워크플로우 만들어줘&quot;</li>
                <li>&bull; &quot;에러 리포트 보여줘&quot;</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
