import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { healthCheck, listWorkflows, listUsers } from '@/lib/n8n-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const { alive, latencyMs } = await healthCheck(server)

    if (!alive) {
      return NextResponse.json({ serverId, alive: false, latencyMs })
    }

    const [workflows, users] = await Promise.allSettled([
      listWorkflows(server),
      listUsers(server),
    ])

    return NextResponse.json({
      serverId,
      alive: true,
      latencyMs,
      workflowCount: workflows.status === 'fulfilled' ? workflows.value.length : null,
      userCount: users.status === 'fulfilled' ? users.value.length : null,
    })
  } catch (e) {
    return NextResponse.json({ alive: false, error: String(e) }, { status: 500 })
  }
}
