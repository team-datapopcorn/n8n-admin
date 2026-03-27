import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import {
  listWorkflows,
  listCredentials,
  listProjects,
  transferWorkflowOwnership,
  transferCredentialOwnership,
} from '@/lib/n8n-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ server: string; id: string }> },
) {
  try {
    const { server: serverId, id: userId } = await params
    const server = getServer(serverId)

    const [workflows, credentials, projects] = await Promise.all([
      listWorkflows(server),
      listCredentials(server),
      listProjects(server),
    ])

    // Find the user's personal project
    const userProject = projects.find(
      (p) => p.type === 'personal' && p.id.includes(userId),
    )

    const ownedWorkflows = userProject
      ? workflows.filter((wf) =>
          wf.shared?.some((s) => s.projectId === userProject.id && s.role === 'workflow:owner'),
        )
      : []

    const ownedCredentials = userProject
      ? credentials.filter((c: unknown) =>
          (c as { homeProject?: { id: string } }).homeProject?.id === userProject.id,
        )
      : []

    return NextResponse.json({
      projectId: userProject?.id ?? null,
      workflows: ownedWorkflows.map((wf) => ({ id: wf.id, name: wf.name, active: wf.active })),
      credentials: ownedCredentials.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ server: string; id: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const { targetProjectId, workflowIds, credentialIds } = await req.json()

    const results = {
      workflows: [] as string[],
      credentials: [] as string[],
      failed: [] as { id: string; error: string }[],
    }

    for (const wfId of workflowIds ?? []) {
      try {
        await transferWorkflowOwnership(server, wfId, targetProjectId)
        results.workflows.push(wfId)
      } catch (e) {
        results.failed.push({ id: wfId, error: String(e) })
      }
    }

    for (const credId of credentialIds ?? []) {
      try {
        await transferCredentialOwnership(server, credId, targetProjectId)
        results.credentials.push(credId)
      } catch (e) {
        results.failed.push({ id: credId, error: String(e) })
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
