'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { ServerConfig, N8nUser } from '@/lib/types'
import { UserPlus, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'
import { DEMO_USERS, DEMO_SERVER } from '@/lib/demo-data'

type SortKey = 'email' | 'role' | 'daysSinceActive'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ArrowUpDown size={12} className="ml-1 opacity-40" />
  return sortDir === 'asc' ? <ArrowUp size={12} className="ml-1" /> : <ArrowDown size={12} className="ml-1" />
}

export default function UsersClient({ servers }: { servers: ServerConfig[] }) {
  const { isDemoMode } = useDemoMode()
  const effectiveServers = isDemoMode ? [DEMO_SERVER] : servers
  const [server, setServer] = useState<string>(servers[0]?.id ?? '')
  const [dormantDays, setDormantDays] = useState(90)
  const [sortKey, setSortKey] = useState<SortKey>('daysSinceActive')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [inviteEmail, setInviteEmail] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data = [], isLoading, isError } = useQuery<N8nUser[]>({
    queryKey: ['users', isDemoMode ? 'demo' : server],
    queryFn: () => {
      if (isDemoMode) return Promise.resolve(DEMO_USERS)
      return fetch(`/api/servers/${server}/users`).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
    },
  })

  const inviteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/servers/${server}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      }),
    onSuccess: () => {
      toast.success('초대 이메일을 발송했습니다.')
      setInviteEmail('')
      setShowInvite(false)
      qc.invalidateQueries({ queryKey: ['users', server] })
    },
    onError: () => toast.error('초대에 실패했습니다.'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/servers/${server}/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('유저가 삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['users', server] })
      setDeleteId(null)
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  const sorted = [...data].sort((a, b) => {
    let av: string | number | undefined
    let bv: string | number | undefined
    if (sortKey === 'email') { av = a.email; bv = b.email }
    else if (sortKey === 'role') { av = a.role ?? ''; bv = b.role ?? '' }
    else { av = a.daysSinceActive ?? -1; bv = b.daysSinceActive ?? -1 }
    if (av === bv) return 0
    const cmp = av < bv ? -1 : 1
    return sortDir === 'asc' ? cmp : -cmp
  })

  const dormant = data.filter(
    (u) => u.role !== 'global:owner' && u.role !== 'global:admin' &&
      u.daysSinceActive !== undefined && u.daysSinceActive >= dormantDays
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">유저 관리</h2>
        <Button
          size="sm"
          disabled={isDemoMode}
          title={isDemoMode ? '데모 모드에서는 사용할 수 없습니다' : undefined}
          onClick={() => setShowInvite(true)}
        >
          <UserPlus size={14} className="mr-1" /> 초대
        </Button>
      </div>

      <Tabs value={isDemoMode ? 'demo' : server} onValueChange={(v) => setServer(v)}>
        <TabsList>
          {effectiveServers.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-4 text-sm">
        <span>전체 {data.length}명</span>
        <span className="text-muted-foreground">|</span>
        <span className="text-orange-500">휴면({dormantDays}일 이상) {dormant.length}명</span>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-muted-foreground">휴면 기준(일)</label>
          <Input
            type="number"
            value={dormantDays}
            onChange={(e) => setDormantDays(Number(e.target.value))}
            className="w-20 h-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('email')}>
                <span className="flex items-center">이메일<SortIcon col="email" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('role')}>
                <span className="flex items-center">역할<SortIcon col="role" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('daysSinceActive')}>
                <span className="flex items-center">마지막 접속<SortIcon col="daysSinceActive" sortKey={sortKey} sortDir={sortDir} /></span>
              </TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">불러오는 중...</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-destructive text-sm">유저 목록을 불러오지 못했습니다.</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">유저 없음</TableCell></TableRow>
            ) : (
              sorted.map((u) => {
                const isDormant = u.daysSinceActive !== undefined && u.daysSinceActive >= dormantDays
                const isProtected = u.role === 'global:owner' || u.role === 'global:admin'
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground">{u.firstName} {u.lastName}</TableCell>
                    <TableCell>
                      <Badge variant={isProtected ? 'default' : 'secondary'} className="text-xs">
                        {u.role?.replace('global:', '') ?? 'member'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(u.lastActiveAt ?? u.updatedAt)
                        ? (
                          <span>
                            {u.daysSinceActive}일 전
                            <span className="block text-xs">{new Date((u.lastActiveAt ?? u.updatedAt)!).toLocaleDateString('ko-KR')}</span>
                          </span>
                        )
                        : u.isPending ? '미수락' : '-'}
                    </TableCell>
                    <TableCell>
                      {u.isPending ? (
                        <Badge variant="outline" className="text-xs">초대 대기</Badge>
                      ) : isDormant ? (
                        <Badge variant="destructive" className="text-xs">휴면</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-green-600">활성</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isProtected && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={isDemoMode}
                          title={isDemoMode ? '데모 모드에서는 사용할 수 없습니다' : undefined}
                          onClick={() => setDeleteId(u.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 초대 다이얼로그 */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>유저 초대</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="이메일 주소"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              type="email"
            />
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteEmail || inviteMutation.isPending}
              className="w-full"
            >
              {inviteMutation.isPending ? '발송 중...' : '초대 이메일 발송'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>유저 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteId!)}
            >삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
