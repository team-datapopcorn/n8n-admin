'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ServerId } from '@/lib/types'
import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'

interface ServerHealthCardProps {
  serverId: ServerId
  name?: string
  url?: string
  description?: string
}

export default function ServerHealthCard({ serverId, name, url, description }: ServerHealthCardProps) {
  const displayName = name ?? serverId

  const { data, isLoading } = useQuery({
    queryKey: ['health', serverId],
    queryFn: () => fetch(`/api/servers/${serverId}/health`).then((r) => r.json()),
    refetchInterval: 60_000,
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">{displayName}</CardTitle>
        {isLoading ? (
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        ) : data?.alive ? (
          <CheckCircle2 size={18} className="text-green-500" />
        ) : (
          <XCircle size={18} className="text-red-500" />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {description && <p className="text-xs text-muted-foreground">{description}</p>}

        {!isLoading && (
          <>
            <Badge variant={data?.alive ? 'default' : 'destructive'} className="text-xs">
              {data?.alive ? '정상' : '오프라인'}
            </Badge>

            {data?.alive && (
              <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">워크플로우</p>
                  <p className="font-semibold">{data.workflowCount ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">유저</p>
                  <p className="font-semibold">{data.userCount ?? '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">응답시간</p>
                  <p className="font-semibold">{data.latencyMs}ms</p>
                </div>
              </div>
            )}
          </>
        )}

        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors pt-1"
          >
            <ExternalLink size={12} />
            {url.replace('https://', '')}
          </a>
        )}
      </CardContent>
    </Card>
  )
}
