import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listExecutions, listWorkflows } from '@/lib/n8n-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)

    const [executions, workflows] = await Promise.all([
      listExecutions(server, { status: 'error', limit: 100 }),
      listWorkflows(server),
    ])

    const wfMap = new Map(workflows.map((w) => [w.id, w.name]))
    const now = Date.now()
    const last24h = executions.filter((e) => now - new Date(e.startedAt).getTime() < 86400000)

    const errorCounts = new Map<string, { name: string; count: number; lastError: string }>()
    for (const exec of last24h) {
      const existing = errorCounts.get(exec.workflowId)
      if (existing) {
        existing.count++
      } else {
        errorCounts.set(exec.workflowId, {
          name: wfMap.get(exec.workflowId) ?? exec.workflowId,
          count: 1,
          lastError: exec.stoppedAt ?? exec.startedAt,
        })
      }
    }

    const byWorkflow = [...errorCounts.entries()]
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      totalErrors24h: last24h.length,
      affectedWorkflows: byWorkflow.length,
      byWorkflow,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
