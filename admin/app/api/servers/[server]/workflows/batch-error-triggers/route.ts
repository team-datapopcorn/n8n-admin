import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows, getWorkflow, updateWorkflow, workflowHasErrorTrigger } from '@/lib/n8n-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ server: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const active = workflows.filter((wf) => wf.active)
    const withTrigger = active.filter(workflowHasErrorTrigger)
    const withoutTrigger = active.filter((wf) => !workflowHasErrorTrigger(wf))

    return NextResponse.json({
      total: workflows.length,
      active: active.length,
      withErrorTrigger: withTrigger.length,
      withoutErrorTrigger: withoutTrigger.map((wf) => ({ id: wf.id, name: wf.name })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ server: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const { workflowIds } = (await req.json()) as { workflowIds: string[] }

    const results = { added: [] as string[], failed: [] as { id: string; error: string }[] }

    for (const id of workflowIds) {
      try {
        const wf = await getWorkflow(server, id)
        if (workflowHasErrorTrigger(wf)) continue

        const errorTriggerNode = {
          parameters: {},
          type: 'n8n-nodes-base.errorTrigger',
          typeVersion: 1,
          position: [-200, 0],
          id: `error-trigger-${id}`,
          name: 'Error Trigger',
        }

        const updatedNodes = [...(wf.nodes as unknown[] ?? []), errorTriggerNode]
        await updateWorkflow(server, id, { ...wf, nodes: updatedNodes })
        results.added.push(id)
      } catch (e) {
        results.failed.push({ id, error: String(e) })
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
