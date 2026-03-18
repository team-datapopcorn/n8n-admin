import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { getWorkflow, createWorkflow } from '@/lib/n8n-client'

export async function POST(req: NextRequest) {
  try {
    const { fromServer, toServer, workflowId } = await req.json()
    const src = getServer(fromServer)
    const dst = getServer(toServer)
    const workflow = await getWorkflow(src, workflowId)
    const created = await createWorkflow(dst, workflow)
    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
