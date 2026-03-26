'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ServerConfig, N8nWorkflow, N8nProject } from '@/lib/types'
import { Copy, Trash2, Eye, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { useDemoMode } from '@/lib/demo-context'
import { DEMO_WORKFLOWS, DEMO_SERVER } from '@/lib/demo-data'

type SortKey = 'name' | 'active' | 'archived' | 'owner' | 'nodes' | 'updatedAt'
type SortDir = 'asc' | 'desc'

function getOwnerName(workflow: N8nWorkflow, projects: N8nProject[]): string {
  const ownerShared = workflow.shared?.find((s) => s.role === 'workflow:owner')
  if (!ownerShared) return '-'
  const project = projects.find((p) => p.id === ownerShared.projectId)
  if (!project) return '-'
  // personal project: "Name <email>" → extract email
  if (project.type === 'personal') {
    const match = project.name.match(/<(.+?)>/)
    return match ? match[1] : project.name
  }
  return project.name
}

export default function WorkflowsClient({ servers }: { servers: ServerConfig[] }) {
  const { isDemoMode } = useDemoMode()
  const effectiveServers = isDemoMode ? [DEMO_SERVER] : servers
  const [server, setServer] = useState<string>(servers[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterOwner, setFilterOwner] = useState<string>('')
  const [filterTag, setFilterTag] = useState<string>('')
  const [viewWorkflow, setViewWorkflow] = useState<N8nWorkflow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [copyWorkflow, setCopyWorkflow] = useState<N8nWorkflow | null>(null)
  const [copyTarget, setCopyTarget] = useState<string>(servers[1]?.id ?? servers[0]?.id ?? '')
  const qc = useQueryClient()

  // Fetch ALL workflows (paginated internally)
  const { data: workflows = [], isLoading, isError } = useQuery<N8nWorkflow[]>({
    queryKey: ['workflows-all', isDemoMode ? 'demo' : server],
    queryFn: async () => {
      if (isDemoMode) return DEMO_WORKFLOWS
      const all: N8nWorkflow[] = []
      let cursor: string | undefined = undefined
      do {
        const params = cursor ? `?limit=100&cursor=${cursor}` : '?limit=100'
        const res = await fetch(`/api/servers/${server}/workflows${params}`)
        if (!res.ok) throw new Error(`${res.status}`)
        const json: { data: N8nWorkflow[]; nextCursor: string | null } = await res.json()
        all.push(...json.data)
        cursor = json.nextCursor ?? undefined
      } while (cursor)
      return all
    },
    staleTime: 5 * 60 * 1000,
  })

  // Fetch projects for owner mapping
  const { data: projects = [] } = useQuery<N8nProject[]>({
    queryKey: ['projects', server],
    queryFn: () => fetch(`/api/servers/${server}/projects`).then((r) => r.ok ? r.json() : []),
    staleTime: 10 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/servers/${server}/workflows/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('워크플로우가 삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['workflows-all', server] })
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
      qc.invalidateQueries({ queryKey: ['workflows-all', copyTarget] })
      setCopyWorkflow(null)
    },
    onError: () => toast.error('복사에 실패했습니다.'),
  })

  // Extract unique owners and tags for filter dropdowns
  const { ownerOptions, tagOptions } = useMemo(() => {
    const owners = new Set<string>()
    const tags = new Set<string>()
    for (const w of workflows) {
      const owner = getOwnerName(w, projects)
      if (owner !== '-') owners.add(owner)
      for (const t of w.tags ?? []) tags.add(t.name)
    }
    return {
      ownerOptions: [...owners].sort(),
      tagOptions: [...tags].sort(),
    }
  }, [workflows, projects])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'updatedAt' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="ml-1 text-muted-foreground opacity-50" />
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="ml-1 text-foreground" />
      : <ArrowDown size={12} className="ml-1 text-foreground" />
  }

  const filtered = useMemo(() => {
    return workflows
      .filter((w) => {
        if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false
        if (filterOwner && getOwnerName(w, projects) !== filterOwner) return false
        if (filterTag && !(w.tags ?? []).some((t) => t.name === filterTag)) return false
        return true
      })
      .sort((a, b) => {
        let cmp = 0
        if (sortKey === 'name') {
          cmp = a.name.localeCompare(b.name, 'ko')
        } else if (sortKey === 'active') {
          cmp = Number(b.active) - Number(a.active)
        } else if (sortKey === 'archived') {
          cmp = Number(a.isArchived ?? false) - Number(b.isArchived ?? false)
        } else if (sortKey === 'owner') {
          cmp = getOwnerName(a, projects).localeCompare(getOwnerName(b, projects))
        } else if (sortKey === 'nodes') {
          cmp = ((a.nodes as unknown[])?.length ?? 0) - ((b.nodes as unknown[])?.length ?? 0)
        } else if (sortKey === 'updatedAt') {
          cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        }
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [workflows, projects, search, filterOwner, filterTag, sortKey, sortDir])

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">워크플로우</h2>

      <Tabs value={isDemoMode ? 'demo' : server} onValueChange={(v) => { setServer(v); setFilterOwner(''); setFilterTag('') }}>
        <TabsList>
          {effectiveServers.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="워크플로우 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Owner filter */}
        {ownerOptions.length > 0 && (
          <div className="flex items-center gap-1">
            <Select value={filterOwner} onValueChange={(v) => setFilterOwner(v ?? '')}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="Owner 필터" />
              </SelectTrigger>
              <SelectContent>
                {ownerOptions.map((o) => (
                  <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterOwner && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFilterOwner('')}>
                <X size={14} />
              </Button>
            )}
          </div>
        )}

        {/* Tag filter */}
        {tagOptions.length > 0 && (
          <div className="flex items-center gap-1">
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v ?? '')}>
              <SelectTrigger className="w-40 h-9 text-xs">
                <SelectValue placeholder="태그 필터" />
              </SelectTrigger>
              <SelectContent>
                {tagOptions.map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filterTag && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setFilterTag('')}>
                <X size={14} />
              </Button>
            )}
          </div>
        )}

        <span className="text-sm text-muted-foreground">
          {filtered.length} / {workflows.length}개
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
                <button onClick={() => handleSort('owner')} className="flex items-center hover:text-foreground transition-colors">
                  Owner<SortIcon col="owner" />
                </button>
              </TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>
                <button onClick={() => handleSort('active')} className="flex items-center hover:text-foreground transition-colors">
                  Published<SortIcon col="active" />
                </button>
              </TableHead>
              <TableHead>
                <button onClick={() => handleSort('archived')} className="flex items-center hover:text-foreground transition-colors">
                  Archived<SortIcon col="archived" />
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
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
                  전체 워크플로우 불러오는 중...
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-destructive text-sm py-10">
                  워크플로우를 불러오지 못했습니다.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-10">
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
                  <TableCell className="text-xs text-muted-foreground max-w-32 truncate">
                    {getOwnerName(w, projects)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(w.tags ?? []).map((t) => (
                        <Badge key={t.id} variant="outline" className="text-xs font-normal">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={w.active ? 'default' : 'secondary'}>
                      {w.active ? 'Yes' : 'No'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {w.isArchived ? (
                      <Badge variant="outline">Archived</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
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
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isDemoMode}
                        title={isDemoMode ? '데모 모드에서는 사용할 수 없습니다' : undefined}
                        onClick={() => setCopyWorkflow(w)}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={isDemoMode}
                        title={isDemoMode ? '데모 모드에서는 사용할 수 없습니다' : undefined}
                        onClick={() => setDeleteId(w.id)}
                        className="text-destructive hover:text-destructive"
                      >
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
