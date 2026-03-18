import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { getWorkflow, deleteWorkflow } from '@/lib/n8n-client'

type Params = Promise<{ server: string; id: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { server: serverId, id } = await params
    const server = getServer(serverId)
    const workflow = await getWorkflow(server, id)
    return NextResponse.json(workflow)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  try {
    const { server: serverId, id } = await params
    const server = getServer(serverId)
    await deleteWorkflow(server, id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
