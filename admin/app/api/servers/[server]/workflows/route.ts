import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflowsPage, createWorkflow } from '@/lib/n8n-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 30)
    const result = await listWorkflowsPage(server, limit, cursor)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const body = await req.json()
    const workflow = await createWorkflow(server, body)
    return NextResponse.json(workflow, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
