import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const threshold = Number(req.nextUrl.searchParams.get('nodes') ?? '50')

    const workflows = await listWorkflows(server)

    const large = workflows
      .filter((w) => ((w.nodes as unknown[])?.length ?? 0) >= threshold)
      .map((w) => ({
        id: w.id,
        name: w.name,
        active: w.active,
        nodeCount: (w.nodes as unknown[])?.length ?? 0,
        updatedAt: w.updatedAt,
      }))
      .sort((a, b) => b.nodeCount - a.nodeCount)

    return NextResponse.json({
      totalWorkflows: workflows.length,
      largeCount: large.length,
      threshold,
      large,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
