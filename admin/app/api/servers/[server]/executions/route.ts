import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listExecutions } from '@/lib/n8n-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? undefined
    const workflowId = searchParams.get('workflowId') ?? undefined
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined

    const data = await listExecutions(server, { status, workflowId, limit })
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
