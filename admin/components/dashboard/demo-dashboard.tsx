'use client'

import { useDemoMode } from '@/lib/demo-context'
import { DEMO_SERVER } from '@/lib/demo-data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function DemoDashboard() {
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">{DEMO_SERVER.name}</CardTitle>
          <Badge variant="outline" className="text-green-600 border-green-300">RUNNING</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>워크플로우: 5개</p>
          <p>유저: 3명</p>
          <p>지연시간: 42ms</p>
        </CardContent>
      </Card>
    </div>
  )
}
