import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const daysThreshold = Number(req.nextUrl.searchParams.get('days') ?? '30')

    const workflows = await listWorkflows(server)
    const now = Date.now()

    const stale = workflows.filter((w) => {
      if (w.active) return false
      const daysSinceUpdate = Math.floor((now - new Date(w.updatedAt).getTime()) / 86400000)
      return daysSinceUpdate >= daysThreshold
    })

    return NextResponse.json({
      totalWorkflows: workflows.length,
      staleCount: stale.length,
      daysThreshold,
      stale: stale.map((w) => ({
        id: w.id,
        name: w.name,
        updatedAt: w.updatedAt,
        daysSinceUpdate: Math.floor((now - new Date(w.updatedAt).getTime()) / 86400000),
        nodeCount: (w.nodes as unknown[])?.length ?? 0,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
