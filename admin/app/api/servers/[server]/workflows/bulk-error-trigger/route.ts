import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { getWorkflow, updateWorkflow } from '@/lib/n8n-client'

type Params = Promise<{ server: string }>

export async function POST(req: NextRequest, { params }: { params: Params }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const { errorWorkflowId, workflowIds } = await req.json() as {
      errorWorkflowId: string
      workflowIds: string[]
    }

    if (!errorWorkflowId || !workflowIds?.length) {
      return NextResponse.json({ error: 'errorWorkflowId and workflowIds required' }, { status: 400 })
    }

    const results: { id: string; success: boolean; error?: string }[] = []

    for (const wfId of workflowIds) {
      try {
        const wf = await getWorkflow(server, wfId)
        const settings = (wf.settings ?? {}) as Record<string, unknown>
        settings.errorWorkflow = errorWorkflowId

        // settings.errorWorkflow는 워크플로우 설정이라 게시 없이 바로 반영된다
        await updateWorkflow(server, wfId, { ...wf, settings })
        results.push({ id: wfId, success: true })
      } catch (e) {
        results.push({ id: wfId, success: false, error: String(e) })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({ successCount, failCount, results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
