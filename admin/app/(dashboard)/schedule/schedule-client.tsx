'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { Clock, Play, AlertTriangle, Type, ShieldAlert, Users, Archive, Key, ChevronDown, ChevronUp, Zap, Copy, GitCompare, Tag, Gauge } from 'lucide-react'

// ─── 타입 ──────────────────────────────────────────────────

interface ServerInfo { id: string; name: string; url: string }

interface Violation { id: string; name: string; active: boolean; issues: string[]; suggestedName: string }
interface ViolationsResponse { total: number; activeCount: number; violationCount: number; violations: Violation[] }

interface ErrorTriggerResponse {
  activeCount: number; missingCount: number
  errorHandlers: { id: string; name: string }[]
  missing: { id: string; name: string }[]
}

interface DormantUser { id: string; email: string; role?: string; daysSinceActive?: number; isPending: boolean }
interface DormantResponse { totalUsers: number; dormantCount: number; daysThreshold: number; dormant: DormantUser[] }

interface StaleWorkflow { id: string; name: string; updatedAt: string; daysSinceUpdate: number; nodeCount: number }
interface StaleResponse { totalWorkflows: number; staleCount: number; daysThreshold: number; stale: StaleWorkflow[] }

interface AbnormalCred { id: string; name: string; type: string; updatedAt: string }
interface CredCheckResponse { totalCredentials: number; abnormalCount: number; abnormal: AbnormalCred[]; restricted?: boolean }

interface ExecErrorResponse {
  totalErrors24h: number; affectedWorkflows: number
  byWorkflow: { id: string; name: string; count: number; lastError: string }[]
}

interface DuplicateGroup {
  baseName: string; count: number
  workflows: { id: string; name: string; active: boolean; updatedAt: string }[]
}
interface DuplicateResponse { duplicateGroups: number; totalDuplicates: number; duplicates: DuplicateGroup[] }

interface CrossServerItem {
  name: string
  servers: { serverId: string; id: string; active: boolean; updatedAt: string; nodeCount: number }[]
}
interface CrossServerResponse { crossServerCount: number; items: CrossServerItem[] }

interface UntaggedResponse { totalWorkflows: number; untaggedCount: number; untagged: { id: string; name: string; active: boolean }[] }

interface LargeWf { id: string; name: string; active: boolean; nodeCount: number }
interface LargeResponse { totalWorkflows: number; largeCount: number; threshold: number; large: LargeWf[] }

interface CleanupResponse {
  ok: boolean
  results: { serverId: string; renamed: { oldName: string; newName: string; method: string }[]; errors: { name: string }[] }[]
}

// ─── 유틸 ──────────────────────────────────────────────────

const ISSUE_SHORT: Record<string, string> = {
  '프로젝트 태그 없음': '태그 없음',
  '복사/버전 마커 포함': '복사 마커',
  '기본 이름 사용': '기본 이름',
  '설명 없음': '설명 없음',
}
function shortIssue(issue: string) {
  for (const [k, v] of Object.entries(ISSUE_SHORT)) { if (issue.includes(k)) return v }
  return issue.slice(0, 10)
}

// ─── 토글 섹션 ──────────────────────────────────────────────

function Section({ title, icon: Icon, badge, badgeVariant, children, action }: {
  title: string; icon: React.ElementType; badge?: string | number
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline'
  children: React.ReactNode; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <Icon size={16} className="text-muted-foreground" />
            <CardTitle className="text-base">{title}</CardTitle>
            {badge !== undefined && (
              <Badge variant={badgeVariant ?? 'secondary'} className="text-xs">{badge}</Badge>
            )}
            {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
          </button>
          {action}
        </div>
      </CardHeader>
      {open && <CardContent className="pt-3">{children}</CardContent>}
    </Card>
  )
}

// ─── 메인 ──────────────────────────────────────────────────

interface ConfigResponse { geminiConfigured: boolean; geminiSource?: string }

export default function ScheduleClient({ servers }: { servers: ServerInfo[] }) {
  const [server, setServer] = useState(servers[0]?.id ?? '')
  const [lastCleanup, setLastCleanup] = useState<CleanupResponse | null>(null)
  const qc = useQueryClient()

  const geminiConfig = useQuery<ConfigResponse>({
    queryKey: ['gemini-config'],
    queryFn: async () => { const r = await fetch('/api/config'); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 60 * 1000,
  })

  const serverUrl = servers.find((s) => s.id === server)?.url ?? ''
  const serverLabels = Object.fromEntries(servers.map((s) => [s.id, s.name]))

  // 1. 네이밍 컨벤션
  const violations = useQuery<ViolationsResponse>({
    queryKey: ['naming-violations', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/naming-violations`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 2. 에러 트리거
  const errorTrigger = useQuery<ErrorTriggerResponse>({
    queryKey: ['error-trigger-check', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/error-trigger-check`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 3. 휴면 유저
  const dormant = useQuery<DormantResponse>({
    queryKey: ['dormant-users', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/dormant-users?days=30`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 4. 비활성 워크플로우
  const stale = useQuery<StaleResponse>({
    queryKey: ['stale-workflows', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/stale-workflows?days=30`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 5. 크레덴셜 이상
  const credCheck = useQuery<CredCheckResponse>({
    queryKey: ['credential-check', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/credential-check`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 6. 실행 에러
  const execErrors = useQuery<ExecErrorResponse>({
    queryKey: ['execution-errors', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/execution-errors`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 7. 중복 워크플로우
  const duplicates = useQuery<DuplicateResponse>({
    queryKey: ['duplicate-workflows', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/duplicate-workflows`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 8. 크로스 서버 동기화
  const crossServer = useQuery<CrossServerResponse>({
    queryKey: ['cross-server-sync'],
    queryFn: async () => { const r = await fetch('/api/cross-server-sync'); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 5 * 60 * 1000,
    enabled: servers.length >= 2,
  })

  // 9. 태그 미분류
  const untagged = useQuery<UntaggedResponse>({
    queryKey: ['untagged-workflows', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/untagged-workflows`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 10. 대형 워크플로우
  const largeWf = useQuery<LargeResponse>({
    queryKey: ['large-workflows', server],
    queryFn: async () => { const r = await fetch(`/api/servers/${server}/large-workflows?nodes=50`); if (!r.ok) throw new Error(`${r.status}`); return r.json() },
    staleTime: 2 * 60 * 1000,
    enabled: !!server,
  })

  // 네이밍 클린업 실행
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/naming-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId: server }),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || `${res.status}`) }
      return res.json() as Promise<CleanupResponse>
    },
    onSuccess: (result) => {
      setLastCleanup(result)
      const r = result.results[0]
      if (r) {
        toast.success(`네이밍: AI ${r.renamed.filter((x) => x.method === 'ai').length}건, 정규화 ${r.renamed.filter((x) => x.method === 'normalize').length}건`)
      }
      qc.invalidateQueries({ queryKey: ['naming-violations', server] })
    },
    onError: (err) => toast.error(`실패: ${err.message}`),
  })

  const cleanupResult = lastCleanup?.results?.find((r) => r.serverId === server)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">스케줄</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock size={14} />
          매일 03:00 KST 자동 실행
        </div>
      </div>

      <Tabs value={server} onValueChange={setServer}>
        <TabsList>
          {servers.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* ── 1. 네이밍 컨벤션 ── */}
      <Section
        title="네이밍 컨벤션"
        icon={Type}
        badge={violations.data?.violationCount ?? '-'}
        badgeVariant={violations.data?.violationCount ? 'destructive' : 'secondary'}
        action={
          <div className="flex items-center gap-2">
            {geminiConfig.data && !geminiConfig.data.geminiConfigured && (
              <a href="/settings" className="text-xs text-amber-600 hover:underline">Gemini 키 필요</a>
            )}
            <Button size="sm" onClick={() => cleanupMutation.mutate()} disabled={cleanupMutation.isPending || !geminiConfig.data?.geminiConfigured}>
              <Play size={14} className="mr-1.5" />
              {cleanupMutation.isPending ? '실행 중...' : '지금 실행'}
            </Button>
          </div>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">
          패턴: <code className="bg-muted px-1 rounded">[프로젝트명] 기능 설명</code> | 금지: (copy), v1, mk2, 기본 이름
        </p>

        {cleanupResult && cleanupResult.renamed.length > 0 && (
          <div className="mb-3 p-3 rounded-md bg-green-50 border border-green-200">
            <p className="text-sm font-medium text-green-700 mb-2">실행 결과</p>
            {cleanupResult.renamed.map((r, i) => (
              <p key={i} className="text-xs text-green-800">
                <span className="line-through">{r.oldName}</span> → <strong>{r.newName}</strong>
                <Badge variant="outline" className="ml-1 text-[10px]">{r.method === 'ai' ? 'AI' : '정규화'}</Badge>
              </p>
            ))}
          </div>
        )}

        {violations.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !violations.data?.violations?.length ? (
          <p className="text-sm text-muted-foreground">모든 워크플로우가 컨벤션을 준수합니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>위반 유형</TableHead>
                  <TableHead>제안</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.data.violations.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm max-w-[200px] truncate">
                      <a href={`${serverUrl}/workflow/${v.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{v.name}</a>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {v.issues.map((issue) => (
                          <Badge key={issue} variant="outline" className="text-[10px] text-amber-700 border-amber-300">{shortIssue(issue)}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {v.suggestedName || <em>AI 필요</em>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 2. 에러 트리거 ── */}
      <Section
        title="에러 트리거 미등록"
        icon={ShieldAlert}
        badge={errorTrigger.data?.missingCount ?? '-'}
        badgeVariant={errorTrigger.data?.missingCount ? 'destructive' : 'secondary'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          활성 워크플로우 중 에러 핸들러가 연결되지 않은 워크플로우
          {errorTrigger.data && ` (${errorTrigger.data.missingCount} / ${errorTrigger.data.activeCount}개)`}
        </p>
        {errorTrigger.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !errorTrigger.data?.missing?.length ? (
          <p className="text-sm text-muted-foreground">모든 활성 워크플로우에 에러 트리거가 등록되어 있습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>워크플로우</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorTrigger.data.missing.slice(0, 20).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">
                      <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{w.id}</TableCell>
                  </TableRow>
                ))}
                {errorTrigger.data.missing.length > 20 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs text-muted-foreground text-center">
                      외 {errorTrigger.data.missing.length - 20}개 더...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 3. 휴면 유저 ── */}
      <Section
        title="휴면 유저 (30일+)"
        icon={Users}
        badge={dormant.data?.dormantCount ?? '-'}
        badgeVariant={dormant.data?.dormantCount ? 'destructive' : 'secondary'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          30일 이상 미접속 유저 (owner 제외)
          {dormant.data && ` — 전체 ${dormant.data.totalUsers}명 중 ${dormant.data.dormantCount}명`}
        </p>
        {dormant.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !dormant.data?.dormant?.length ? (
          <p className="text-sm text-muted-foreground">휴면 유저가 없습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이메일</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>미접속일</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dormant.data.dormant.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{u.role?.replace('global:', '') ?? '-'}</TableCell>
                    <TableCell className="text-sm">{u.daysSinceActive ?? '-'}일</TableCell>
                    <TableCell>
                      {u.isPending
                        ? <Badge variant="outline" className="text-xs">초대 대기</Badge>
                        : <Badge variant="destructive" className="text-xs">휴면</Badge>
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 4. 비활성 워크플로우 ── */}
      <Section
        title="비활성 워크플로우 (30일+)"
        icon={Archive}
        badge={stale.data?.staleCount ?? '-'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          비활성 상태로 30일 이상 미수정된 워크플로우 — 아카이브 후보
          {stale.data && ` (${stale.data.staleCount} / ${stale.data.totalWorkflows}개)`}
        </p>
        {stale.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !stale.data?.stale?.length ? (
          <p className="text-sm text-muted-foreground">정리가 필요한 워크플로우가 없습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>노드</TableHead>
                  <TableHead>미수정일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stale.data.stale.slice(0, 30).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm max-w-[250px] truncate">
                      <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    </TableCell>
                    <TableCell className="text-sm">{w.nodeCount}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{w.daysSinceUpdate}일</TableCell>
                  </TableRow>
                ))}
                {stale.data.stale.length > 30 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-xs text-muted-foreground text-center">
                      외 {stale.data.stale.length - 30}개 더...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 5. 크레덴셜 이상 ── */}
      <Section
        title="크레덴셜 이상 이름"
        icon={Key}
        badge={credCheck.data?.abnormalCount ?? '-'}
        badgeVariant={credCheck.data?.abnormalCount ? 'destructive' : 'secondary'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          기본/복사/테스트 이름의 크레덴셜 — 정리 권장
          {credCheck.data && ` (${credCheck.data.abnormalCount} / ${credCheck.data.totalCredentials}개)`}
        </p>
        {credCheck.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : credCheck.data?.restricted ? (
          <p className="text-sm text-muted-foreground">이 서버는 크레덴셜 API 접근이 제한되어 있습니다</p>
        ) : !credCheck.data?.abnormal?.length ? (
          <p className="text-sm text-muted-foreground">이상 이름 크레덴셜이 없습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>타입</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {credCheck.data.abnormal.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 6. 실행 에러 (24시간) ── */}
      <Section
        title="실행 에러 (24시간)"
        icon={Zap}
        badge={execErrors.data?.totalErrors24h ?? '-'}
        badgeVariant={execErrors.data?.totalErrors24h ? 'destructive' : 'secondary'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          최근 24시간 에러 발생 워크플로우
          {execErrors.data && ` — ${execErrors.data.affectedWorkflows}개 워크플로우에서 ${execErrors.data.totalErrors24h}건`}
        </p>
        {execErrors.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !execErrors.data?.byWorkflow?.length ? (
          <p className="text-sm text-muted-foreground">최근 24시간 에러가 없습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>워크플로우</TableHead>
                  <TableHead>에러 횟수</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {execErrors.data.byWorkflow.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">
                      <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">{w.count}회</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 7. 중복 워크플로우 ── */}
      <Section
        title="중복 워크플로우"
        icon={Copy}
        badge={duplicates.data?.duplicateGroups ?? '-'}
        badgeVariant={duplicates.data?.duplicateGroups ? 'destructive' : 'secondary'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          이름이 유사한 워크플로우 그룹 (copy 후 방치 등)
        </p>
        {duplicates.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !duplicates.data?.duplicates?.length ? (
          <p className="text-sm text-muted-foreground">중복 워크플로우가 없습니다</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-auto">
            {duplicates.data.duplicates.slice(0, 10).map((group) => (
              <div key={group.baseName} className="rounded-md border p-3">
                <p className="text-sm font-medium mb-1">{group.baseName} <Badge variant="secondary" className="text-[10px] ml-1">{group.count}개</Badge></p>
                {group.workflows.map((w) => (
                  <p key={w.id} className="text-xs text-muted-foreground ml-3">
                    <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    {w.active && <Badge variant="default" className="text-[10px] ml-1">활성</Badge>}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 8. 크로스 서버 동기화 ── */}
      {servers.length >= 2 && (
        <Section
          title="크로스 서버 동기화"
          icon={GitCompare}
          badge={crossServer.data?.crossServerCount ?? '-'}
          badgeVariant="secondary"
        >
          <p className="text-xs text-muted-foreground mb-3">
            같은 이름으로 여러 서버에 존재하는 워크플로우
          </p>
          {crossServer.isLoading ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : !crossServer.data?.items?.length ? (
            <p className="text-sm text-muted-foreground">크로스 서버 워크플로우가 없습니다</p>
          ) : (
            <div className="rounded-md border max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>서버</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {crossServer.data.items.slice(0, 20).map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm max-w-[200px] truncate">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {item.servers.map((s) => (
                            <Badge key={s.serverId} variant={s.active ? 'default' : 'secondary'} className="text-[10px]">
                              {serverLabels[s.serverId] ?? s.serverId}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      )}

      {/* ── 9. 태그 미분류 ── */}
      <Section
        title="태그 미분류 워크플로우"
        icon={Tag}
        badge={untagged.data?.untaggedCount ?? '-'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          태그가 없는 워크플로우
          {untagged.data && ` (${untagged.data.untaggedCount} / ${untagged.data.totalWorkflows}개)`}
        </p>
        {untagged.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !untagged.data?.untagged?.length ? (
          <p className="text-sm text-muted-foreground">모든 워크플로우에 태그가 있습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {untagged.data.untagged.slice(0, 30).map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm">
                      <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.active ? 'default' : 'secondary'} className="text-xs">{w.active ? '활성' : '비활성'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {untagged.data.untagged.length > 30 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-xs text-muted-foreground text-center">
                      외 {untagged.data.untagged.length - 30}개 더...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>

      {/* ── 10. 대형 워크플로우 ── */}
      <Section
        title="대형 워크플로우 (50+ 노드)"
        icon={Gauge}
        badge={largeWf.data?.largeCount ?? '-'}
      >
        <p className="text-xs text-muted-foreground mb-3">
          노드 50개 이상 — 성능 이슈 후보
          {largeWf.data && ` (${largeWf.data.largeCount} / ${largeWf.data.totalWorkflows}개)`}
        </p>
        {largeWf.isLoading ? (
          <p className="text-sm text-muted-foreground">불러오는 중...</p>
        ) : !largeWf.data?.large?.length ? (
          <p className="text-sm text-muted-foreground">대형 워크플로우가 없습니다</p>
        ) : (
          <div className="rounded-md border max-h-64 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>이름</TableHead>
                  <TableHead>노드</TableHead>
                  <TableHead>상태</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {largeWf.data.large.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-sm max-w-[250px] truncate">
                      <a href={`${serverUrl}/workflow/${w.id}`} target="_blank" rel="noopener noreferrer" className="hover:underline">{w.name}</a>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{w.nodeCount}개</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.active ? 'default' : 'secondary'} className="text-xs">{w.active ? '활성' : '비활성'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Section>
    </div>
  )
}
