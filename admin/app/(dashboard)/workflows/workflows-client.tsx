'use client'

import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ServerConfig, N8nWorkflow } from '@/lib/types'
import { Copy, Trash2, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type SortKey = 'name' | 'active' | 'nodes' | 'updatedAt'
type SortDir = 'asc' | 'desc'

export default function WorkflowsClient({ servers }: { servers: ServerConfig[] }) {
  const [server, setServer] = useState<string>(servers[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [viewWorkflow, setViewWorkflow] = useState<N8nWorkflow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copyWorkflow, setCopyWorkflow] = useState<N8nWorkflow | null>(null)
  const [copyTarget, setCopyTarget] = useState<string>(servers[1]?.id ?? servers[0]?.id ?? '')
  const qc = useQueryClient()

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<{ data: N8nWorkflow[]; nextCursor: string | null }>({
    queryKey: ['workflows', server],
    queryFn: ({ pageParam }) => {
      const cursor = pageParam ? `&cursor=${pageParam}` : ''
      return fetch(`/api/servers/${server}/workflows?limit=30${cursor}`).then((r) => {
        if (!r.ok) throw new Error(`${r.status}`)
        return r.json()
      })
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
  })

  const allWorkflows = data?.pages.flatMap((p) => p.data) ?? []
  const totalLoaded = allWorkflows.length

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/servers/${server}/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('워크플로우가 삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['workflows', server] })
      setDeleteId(null)
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })

  const copyMutation = useMutation({
    mutationFn: () =>
      fetch('/api/workflows/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromServer: server, toServer: copyTarget, workflowId: copyWorkflow!.id }),
      }),
    onSuccess: () => {
      toast.success(`${servers.find(s => s.id === copyTarget)?.name ?? copyTarget} 서버로 복사되었습니다.`)
      qc.invalidateQueries({ queryKey: ['workflows', copyTarget] })
      setCopyWorkflow(null)
    },
    onError: () => toast.error('복사에 실패했습니다.'),
  })

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 text-muted-foreground opacity-50" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="ml-1 text-foreground" />
      : <ArrowDown size={12} className="ml-1 text-foreground" />
  }

  const filtered = allWorkflows
    .filter((w) => w.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name, 'ko')
      } else if (sortKey === 'active') {
        cmp = Number(b.active) - Number(a.active)
      } else if (sortKey === 'nodes') {
        cmp = ((a.nodes as unknown[])?.length ?? 0) - ((b.nodes as unknown[])?.length ?? 0)
      } else if (sortKey === 'updatedAt') {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">워크플로우</h2>

      <Tabs value={server} onValueChange={(v) => setServer(v)}>
        <TabsList>
          {servers.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="워크플로우 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filtered.length} / {totalLoaded}개 로드됨
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button onClick={() => handleSort('name')} className="flex items-center hover:text-foreground transition-colors">
                  이름<SortIcon col="name" />
                </button>
              </TableHead>
              <TableHead className="text-muted-foreground">ID</TableHead>
              <TableHead>
                <button onClick={() => handleSort('active')} className="flex items-center hover:text-foreground transition-colors">
                  상태<SortIcon col="active" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort('nodes')} className="flex items-center hover:text-foreground transition-colors">
                  노드<SortIcon col="nodes" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort('updatedAt')} className="flex items-center hover:text-foreground transition-colors">
                  수정일<SortIcon col="updatedAt" />
                </button>
              </TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  불러오는 중...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-destructive text-sm py-10">
                  워크플로우를 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                  워크플로우 없음
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium max-w-xs truncate">
                    <a
                      href={`${servers.find(s => s.id === server)?.url}/workflow/${w.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      {w.name}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{w.id}</TableCell>
                  <TableCell>
                    <Badge variant={w.active ? 'default' : 'secondary'}>
                      {w.active ? '활성' : '비활성'}
                    </Badge>
                  </TableCell>
                  <TableCell>{(w.nodes as unknown[])?.length ?? '-'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(w.updatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setViewWorkflow(w)}>
                        <Eye size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setCopyWorkflow(w)}>
                        <Copy size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(w.id)}
                        className="text-destructive hover:text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? '불러오는 중...' : '30개 더 불러오기'}
          </Button>
        </div>
      )}

      {/* 상세 보기 */}
      <Dialog open={!!viewWorkflow} onOpenChange={() => setViewWorkflow(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{viewWorkflow?.name}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted rounded p-4 overflow-auto">
            {JSON.stringify(viewWorkflow, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>

      {/* 복사 다이얼로그 */}
      <Dialog open={!!copyWorkflow} onOpenChange={() => setCopyWorkflow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>다른 서버로 복사</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{copyWorkflow?.name}</p>
          <div className="space-y-3">
            <p className="text-sm font-medium">대상 서버 선택</p>
            <Select value={copyTarget} onValueChange={(v) => setCopyTarget(v ?? '')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {servers.filter((s) => s.id !== server).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending} className="w-full">
              {copyMutation.isPending ? '복사 중...' : '복사하기'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>워크플로우 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteMutation.mutate(deleteId!)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
