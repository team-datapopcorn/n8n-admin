'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { ServerConfig, N8nCredential } from '@/lib/types'
import { Trash2, GitCompare } from 'lucide-react'

export default function CredentialsClient({ servers }: { servers: ServerConfig[] }) {
  const [server, setServer] = useState<string>(servers[0]?.id ?? '')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [showChecklist, setShowChecklist] = useState(false)
  const [checklistTarget, setChecklistTarget] = useState<string>(servers[1]?.id ?? servers[0]?.id ?? '')
  const [checklist, setChecklist] = useState<{ onlyInSrc: N8nCredential[]; onlyInDst: N8nCredential[]; inBoth: N8nCredential[] } | null>(null)
  const qc = useQueryClient()

  const { data = [], isLoading, isError } = useQuery<N8nCredential[]>({
    queryKey: ['credentials', server],
    queryFn: () => fetch(`/api/servers/${server}/credentials`).then((r) => {
      if (!r.ok) throw new Error(`${r.status}`)
      return r.json()
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/servers/${server}/credentials/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('크레덴셜이 삭제되었습니다.')
      qc.invalidateQueries({ queryKey: ['credentials', server] })
      setDeleteId(null)
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  })

  const [checklistLoading, setChecklistLoading] = useState(false)
  async function runChecklist() {
    setChecklistLoading(true)
    try {
      const res = await fetch('/api/credentials/migration-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromServer: server, toServer: checklistTarget }),
      })
      const data = await res.json()
      setChecklist(data)
    } catch {
      toast.error('체크리스트 생성에 실패했습니다.')
    } finally {
      setChecklistLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">크레덴셜 관리</h2>
        <Button size="sm" variant="outline" onClick={() => setShowChecklist(true)}>
          <GitCompare size={14} className="mr-1" /> 마이그레이션 체크리스트
        </Button>
      </div>

      <Tabs value={server} onValueChange={(v) => setServer(v)}>
        <TabsList>
          {servers.map((s) => (
            <TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이름</TableHead>
              <TableHead>타입</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead>수정일</TableHead>
              <TableHead className="text-right">액션</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">불러오는 중...</TableCell></TableRow>
            ) : isError ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-destructive text-sm">이 서버는 크레덴셜 API를 지원하지 않습니다.</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">크레덴셜 없음</TableCell></TableRow>
            ) : (
              data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{c.type}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.updatedAt).toLocaleDateString('ko-KR')}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 마이그레이션 체크리스트 */}
      <Dialog open={showChecklist} onOpenChange={(o) => { setShowChecklist(o); if (!o) setChecklist(null) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader><DialogTitle>마이그레이션 체크리스트</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-medium">{servers.find(s => s.id === server)?.name ?? server}</span>
              <span>→</span>
              <Select value={checklistTarget} onValueChange={(v) => setChecklistTarget(v ?? '')}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {servers.filter((s) => s.id !== server).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={runChecklist} disabled={checklistLoading}>
                {checklistLoading ? '분석 중...' : '분석 실행'}
              </Button>
            </div>

            {checklist && (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-orange-500 mb-1">소스에만 있음 ({checklist.onlyInSrc.length}개) → 이관 필요</p>
                  {checklist.onlyInSrc.map((c) => <p key={c.id} className="text-muted-foreground">• [{c.type}] {c.name}</p>)}
                  {checklist.onlyInSrc.length === 0 && <p className="text-muted-foreground">없음</p>}
                </div>
                <div>
                  <p className="font-semibold text-green-600 mb-1">양쪽 모두 있음 ({checklist.inBoth.length}개)</p>
                  {checklist.inBoth.map((c) => <p key={c.id} className="text-muted-foreground">• [{c.type}] {c.name}</p>)}
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground mb-1">대상에만 있음 ({checklist.onlyInDst.length}개)</p>
                  {checklist.onlyInDst.map((c) => <p key={c.id} className="text-muted-foreground">• [{c.type}] {c.name}</p>)}
                  {checklist.onlyInDst.length === 0 && <p className="text-muted-foreground">없음</p>}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>크레덴셜 삭제</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteMutation.mutate(deleteId!)}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
