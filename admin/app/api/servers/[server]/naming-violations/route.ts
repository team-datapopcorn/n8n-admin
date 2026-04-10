import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'
import { getViolations } from '@/lib/naming-convention'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const activeWorkflows = workflows.filter((w) => w.active)
    const violations = getViolations(
      workflows.map((w) => ({ id: w.id, name: w.name, active: w.active }))
    )

    return NextResponse.json({
      total: workflows.length,
      activeCount: activeWorkflows.length,
      violationCount: violations.length,
      violations,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
