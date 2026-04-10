'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Play, Square, RefreshCw, Settings, Loader2, RotateCcw } from 'lucide-react'
import type { HostingType } from '@/lib/types'

interface HostingServer {
  id: string
  name: string
  hostingType: HostingType
}

interface InstanceStatus {
  instanceId: string
  name: string
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'unknown'
  rawStatus: string
  endpoint?: string
  spec?: string
  lastStartedAt?: string
  provider: string
  providerName: string
  capabilities: {
    startStop: boolean
    restart: boolean
    resize: boolean
    redeploy: boolean
  }
  error?: string
}

interface InstanceSpec {
  value: string
  label: string
  description: string
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === 'running' ? 'default'
    : status === 'stopped' ? 'secondary'
    : 'outline'
  return <Badge variant={variant} className="text-xs">{status.toUpperCase()}</Badge>
}

function ServerCard({ server }: { server: HostingServer }) {
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<'start' | 'stop' | 'restart' | 'redeploy' | null>(null)
  const [showResize, setShowResize] = useState(false)
  const [targetSpec, setTargetSpec] = useState('')

  const { data: vm, isLoading, refetch } = useQuery<InstanceStatus>({
    queryKey: ['hosting-status', server.id],
    queryFn: () => fetch(`/api/hosting/${server.id}/status`).then((r) => r.json()),
    refetchInterval: 15_000,
  })

  const { data: specsData } = useQuery<{ specs: InstanceSpec[] }>({
    queryKey: ['hosting-specs', server.id],
    queryFn: () => fetch(`/api/hosting/${server.id}/specs`).then((r) => r.json()),
    enabled: !!vm?.capabilities.resize,
  })

  const actionMutation = useMutation({
    mutationFn: (action: string) =>
      fetch(`/api/hosting/${server.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => {
        if (!r.ok) throw new Error('요청 실패')
        return r.json()
      }),
    onSuccess: (_, action) => {
      toast.success(`${server.name}: ${action} 완료`)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['hosting-status', server.id] })
      }, 3000)
    },
    onError: (_, action) => toast.error(`${server.name}: ${action} 실패`),
  })

  const resizeMutation = useMutation({
    mutationFn: (spec: string) =>
      fetch(`/api/hosting/${server.id}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      }).then((r) => {
        if (!r.ok) throw new Error('요청 실패')
        return r.json()
      }),
    onSuccess: () => {
      toast.success(`${server.name}: 리사이즈 완료`)
      setShowResize(false)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['hosting-status', server.id] })
      }, 5000)
    },
    onError: () => toast.error(`${server.name}: 리사이즈 실패`),
  })

  const isRunning = vm?.status === 'running'
  const isBusy = actionMutation.isPending || resizeMutation.isPending
  const caps = vm?.capabilities
  const specs = specsData?.specs ?? []

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">{server.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{vm?.providerName ?? server.hostingType.toUpperCase()}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" /> 조회 중...
            </div>
          ) : vm?.error ? (
            <p className="text-destructive text-sm">{vm.error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">상태</p>
                  <StatusBadge status={vm?.status ?? 'unknown'} />
                </div>
                {vm?.spec && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">스펙</p>
                    <p className="font-medium">{vm.spec}</p>
                  </div>
                )}
                {vm?.endpoint && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">엔드포인트</p>
                    <p className="font-medium font-mono text-sm">{vm.endpoint}</p>
                  </div>
                )}
                {vm?.lastStartedAt && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">마지막 시작</p>
                    <p className="font-medium text-sm">
                      {new Date(vm.lastStartedAt).toLocaleString('ko-KR')}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {caps?.startStop && (
                  <>
                    <Button size="sm" variant="outline" disabled={isRunning || isBusy} onClick={() => setConfirmAction('start')}>
                      <Play size={14} className="mr-1" /> 시작
                    </Button>
                    <Button size="sm" variant="outline" disabled={!isRunning || isBusy} onClick={() => setConfirmAction('stop')}>
                      <Square size={14} className="mr-1" /> 중지
                    </Button>
                  </>
                )}
                {caps?.restart && (
                  <Button size="sm" variant="outline" disabled={!isRunning || isBusy} onClick={() => setConfirmAction('restart')}>
                    <RefreshCw size={14} className="mr-1" /> 재시작
                  </Button>
                )}
                {caps?.redeploy && (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => setConfirmAction('redeploy')}>
                    <RotateCcw size={14} className="mr-1" /> 재배포
                  </Button>
                )}
                {caps?.resize && (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => {
                    if (specs.length > 0 && !targetSpec) setTargetSpec(specs[0].value)
                    setShowResize(true)
                  }}>
                    <Settings size={14} className="mr-1" /> 리사이즈
                  </Button>
                )}
              </div>

              {isBusy && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> 작업 진행 중...
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 확인 다이얼로그 */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {server.name} — {confirmAction === 'start' ? '시작' : confirmAction === 'stop' ? '중지' : confirmAction === 'restart' ? '재시작' : '재배포'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'stop'
                ? '서버를 중지하면 n8n 서비스가 중단됩니다. 계속하시겠습니까?'
                : confirmAction === 'restart'
                ? '서버를 재시작하면 잠시 n8n 서비스가 중단됩니다. 계속하시겠습니까?'
                : confirmAction === 'redeploy'
                ? '서버를 재배포합니다. 잠시 다운타임이 발생할 수 있습니다. 계속하시겠습니까?'
                : '서버를 시작합니다. 계속하시겠습니까?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmAction) actionMutation.mutate(confirmAction)
              setConfirmAction(null)
            }}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 리사이즈 다이얼로그 */}
      <AlertDialog open={showResize} onOpenChange={setShowResize}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{server.name} — 리사이즈</AlertDialogTitle>
            <AlertDialogDescription>
              스펙이 변경됩니다. 다운타임이 발생할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={targetSpec} onValueChange={(v) => v && setTargetSpec(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {specs.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label} — {s.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resizeMutation.mutate(targetSpec)}
              disabled={resizeMutation.isPending}
            >
              {resizeMutation.isPending ? '변경 중...' : '변경하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function HostingClient({ servers }: { servers: HostingServer[] }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">인프라 관리</h2>
      <div className="grid gap-4">
        {servers.map((server) => (
          <ServerCard key={server.id} server={server} />
        ))}
      </div>
    </div>
  )
}
