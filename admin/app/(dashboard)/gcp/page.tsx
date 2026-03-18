'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { GcpVmStatus, MACHINE_TYPES } from '@/lib/types'
import { useState } from 'react'
import { Play, Square, RefreshCw, Settings, Loader2 } from 'lucide-react'

export default function GcpPage() {
  const [confirmAction, setConfirmAction] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [showResize, setShowResize] = useState(false)
  const [targetMachine, setTargetMachine] = useState('e2-standard-2')

  const { data: vm, isLoading, refetch } = useQuery<GcpVmStatus>({
    queryKey: ['gcp-status'],
    queryFn: () => fetch('/api/gcp/status').then((r) => r.json()),
    refetchInterval: 15_000,
  })

  function action(endpoint: string, label: string) {
    return useMutation({
      mutationFn: () => fetch(`/api/gcp/${endpoint}`, { method: 'POST' }),
      onSuccess: () => {
        toast.success(`${label} 완료`)
        setTimeout(() => refetch(), 3000)
      },
      onError: () => toast.error(`${label} 실패`),
    })
  }

  const startMutation = action('start', 'VM 시작')
  const stopMutation = action('stop', 'VM 중지')
  const restartMutation = action('restart', 'VM 재시작')

  const resizeMutation = useMutation({
    mutationFn: () =>
      fetch('/api/gcp/resize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineType: targetMachine }),
      }),
    onSuccess: () => {
      toast.success('리사이즈 완료 (시작까지 수분 소요)')
      setShowResize(false)
      setTimeout(() => refetch(), 5000)
    },
    onError: () => toast.error('리사이즈 실패'),
  })

  const isRunning = vm?.status === 'RUNNING'
  const isBusy = startMutation.isPending || stopMutation.isPending || restartMutation.isPending || resizeMutation.isPending

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">GCP VM 제어</h2>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>automation</CardTitle>
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
                  <Badge variant={isRunning ? 'default' : 'secondary'} className="text-xs">
                    {vm?.status ?? '-'}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">머신 타입</p>
                  <p className="font-medium">{vm?.machineType ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">외부 IP</p>
                  <p className="font-medium font-mono text-sm">{vm?.externalIp ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">마지막 시작</p>
                  <p className="font-medium text-sm">
                    {vm?.lastStartTimestamp
                      ? new Date(vm.lastStartTimestamp).toLocaleString('ko-KR')
                      : '-'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  size="sm" variant="outline"
                  disabled={isRunning || isBusy}
                  onClick={() => setConfirmAction('start')}
                >
                  <Play size={14} className="mr-1" /> 시작
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={!isRunning || isBusy}
                  onClick={() => setConfirmAction('stop')}
                >
                  <Square size={14} className="mr-1" /> 중지
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={!isRunning || isBusy}
                  onClick={() => setConfirmAction('restart')}
                >
                  <RefreshCw size={14} className="mr-1" /> 재시작
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={isBusy}
                  onClick={() => setShowResize(true)}
                >
                  <Settings size={14} className="mr-1" /> 리사이즈
                </Button>
              </div>

              {isBusy && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> 작업 진행 중... 완료 후 자동 갱신됩니다.
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
              VM {confirmAction === 'start' ? '시작' : confirmAction === 'stop' ? '중지' : '재시작'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === 'stop'
                ? 'VM을 중지하면 n8n 서비스가 중단됩니다. 계속하시겠습니까?'
                : confirmAction === 'restart'
                ? 'VM을 재시작하면 잠시 n8n 서비스가 중단됩니다. 계속하시겠습니까?'
                : 'VM을 시작합니다. 계속하시겠습니까?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (confirmAction === 'start') startMutation.mutate()
              if (confirmAction === 'stop') stopMutation.mutate()
              if (confirmAction === 'restart') restartMutation.mutate()
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
            <AlertDialogTitle>VM 리사이즈</AlertDialogTitle>
            <AlertDialogDescription>
              VM이 중지되고 머신 타입이 변경된 후 재시작됩니다. 수분 소요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Select value={targetMachine} onValueChange={(v) => v && setTargetMachine(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MACHINE_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label} — {m.specs}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resizeMutation.mutate()}
              disabled={resizeMutation.isPending}
            >
              {resizeMutation.isPending ? '변경 중...' : '변경하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
