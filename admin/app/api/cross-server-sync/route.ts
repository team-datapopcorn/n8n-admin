import { NextResponse } from 'next/server'
import { getServers } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

export async function GET() {
  try {
    const servers = getServers()

    const serverWorkflows = await Promise.all(
      servers.map(async (server) => {
        const wfs = await listWorkflows(server)
        return { serverId: server.id, workflows: wfs }
      })
    )

    const nameMap = new Map<string, { serverId: string; id: string; active: boolean; updatedAt: string; nodeCount: number }[]>()
    for (const { serverId, workflows } of serverWorkflows) {
      for (const wf of workflows) {
        const key = wf.name.trim().toLowerCase()
        const list = nameMap.get(key) ?? []
        list.push({
          serverId,
          id: wf.id,
          active: wf.active,
          updatedAt: wf.updatedAt,
          nodeCount: (wf.nodes as unknown[])?.length ?? 0,
        })
        nameMap.set(key, list)
      }
    }

    const crossServer = [...nameMap.entries()]
      .filter(([, items]) => {
        const serverSet = new Set(items.map((i) => i.serverId))
        return serverSet.size >= 2
      })
      .map(([name, items]) => ({
        name,
        servers: items.map((i) => ({
          serverId: i.serverId,
          id: i.id,
          active: i.active,
          updatedAt: i.updatedAt,
          nodeCount: i.nodeCount,
        })),
      }))
      .sort((a, b) => b.servers.length - a.servers.length)

    return NextResponse.json({
      crossServerCount: crossServer.length,
      items: crossServer,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
