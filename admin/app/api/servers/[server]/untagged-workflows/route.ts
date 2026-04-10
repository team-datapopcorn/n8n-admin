import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const untagged = workflows.filter((w) => !w.tags?.length)

    return NextResponse.json({
      totalWorkflows: workflows.length,
      untaggedCount: untagged.length,
      untagged: untagged.map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        updatedAt: w.updatedAt,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
