import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows } from '@/lib/n8n-client'

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(copy\)\s*\d*/gi, '')
    .replace(/\s+copy\s*\d*$/gi, '')
    .replace(/\s*v\d+(\.\d+)*$/g, '')
    .replace(/\s*mk\d+$/g, '')
    .replace(/\s+\d+$/, '')
    .trim()
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const groups = new Map<string, { id: string; name: string; active: boolean; updatedAt: string }[]>()
    for (const wf of workflows) {
      const key = normalize(wf.name)
      if (!key) continue
      const group = groups.get(key) ?? []
      group.push({ id: wf.id, name: wf.name, active: wf.active, updatedAt: wf.updatedAt })
      groups.set(key, group)
    }

    const duplicates = [...groups.entries()]
      .filter(([, items]) => items.length >= 2)
      .map(([baseName, items]) => ({
        baseName,
        count: items.length,
        workflows: items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      duplicateGroups: duplicates.length,
      totalDuplicates: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
