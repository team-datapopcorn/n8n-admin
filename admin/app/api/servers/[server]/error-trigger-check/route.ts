import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

interface WorkflowSettings {
  errorWorkflow?: string
  [key: string]: unknown
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const active = workflows.filter((w) => w.active)
    const missing = active.filter((w) => {
      const settings = w.settings as WorkflowSettings | undefined
      return !settings?.errorWorkflow
    })

    const errorHandlers = workflows.filter((w) => {
      const nodes = w.nodes as { type?: string }[] | undefined
      return nodes?.some((n) => n.type === 'n8n-nodes-base.errorTrigger')
    })

    return NextResponse.json({
      activeCount: active.length,
      missingCount: missing.length,
      errorHandlers: errorHandlers.map((w) => ({ id: w.id, name: w.name })),
      missing: missing.map((w) => ({ id: w.id, name: w.name })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
