import { ServerConfig, N8nWorkflow, N8nUser, N8nCredential, N8nProject, N8nExecution } from './types'

// ─── n8n 2.x/3.x 공개 API 호환 ────────────────────────────────────────────
// n8n 2.0부터 PUT/POST /workflows 본문 검증이 strict해져서, GET으로 받은 객체를
// 그대로 보내면 active·activeVersionId·tags 같은 읽기 전용 필드 때문에 400이 난다.
// 쓰기 가능한 필드만 골라서 보낸다.
const WRITABLE_NODE_KEYS = [
  'id', 'name', 'webhookId', 'disabled', 'notesInFlow', 'notes', 'type', 'typeVersion',
  'executeOnce', 'alwaysOutputData', 'retryOnFail', 'maxTries', 'waitBetweenTries',
  'continueOnFail', 'onError', 'position', 'parameters', 'credentials',
] as const

const WRITABLE_SETTINGS: Record<string, readonly string[] | null> = {
  saveExecutionProgress: null,
  saveManualExecutions: null,
  saveDataErrorExecution: ['all', 'none'],
  saveDataSuccessExecution: ['all', 'none'],
  executionTimeout: null,
  errorWorkflow: null,
  timezone: null,
  executionOrder: null,
  callerPolicy: ['any', 'none', 'workflowsFromAList', 'workflowsFromSameOwner'],
  callerIds: null,
  timeSavedMode: ['fixed', 'dynamic'],
  timeSavedPerExecution: null,
  redactionPolicy: ['none', 'non-manual', 'manual-only', 'all'],
  availableInMCP: null,
}

function pick(obj: Record<string, unknown>, keys: readonly string[]) {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k]
  return out
}

export function toWritableWorkflow(workflow: N8nWorkflow): Record<string, unknown> {
  const raw = workflow as unknown as Record<string, unknown>
  const settingsIn = (workflow.settings ?? {}) as Record<string, unknown>
  const settings: Record<string, unknown> = {}
  for (const [k, allowed] of Object.entries(WRITABLE_SETTINGS)) {
    const v = settingsIn[k]
    if (v === undefined || v === null) continue
    if (allowed && !allowed.includes(String(v))) continue
    settings[k] = v
  }
  const body: Record<string, unknown> = {
    name: workflow.name,
    nodes: ((workflow.nodes ?? []) as Record<string, unknown>[]).map((n) => pick(n, WRITABLE_NODE_KEYS)),
    connections: workflow.connections ?? {},
    settings,
  }
  if (workflow.staticData != null) body.staticData = workflow.staticData
  if (typeof raw.description === 'string') body.description = raw.description
  if (Array.isArray(raw.nodeGroups) && raw.nodeGroups.length) body.nodeGroups = raw.nodeGroups
  return body
}

/** n8n 2.0+: activeVersionId가 있으면 게시(published) 상태. 1.x는 active 필드. */
export function isPublished(workflow: Pick<N8nWorkflow, 'active' | 'activeVersionId'>): boolean {
  if (workflow.activeVersionId !== undefined) return workflow.activeVersionId !== null
  return Boolean(workflow.active)
}

function normalizeWorkflow<T extends N8nWorkflow>(wf: T): T {
  return { ...wf, active: isPublished(wf) }
}

async function n8nError(res: Response, what: string): Promise<Error> {
  let detail = ''
  try { detail = (await res.text()).slice(0, 300) } catch {}
  return new Error(`${what}: ${res.status}${detail ? ` ${detail}` : ''}`)
}

async function fetchAllPages<T>(url: string, apiKey: string): Promise<T[]> {
  const results: T[] = []
  let cursor: string | null = null

  do {
    const sep = url.includes('?') ? '&' : '?'
    const pageUrl: string = cursor
      ? `${url}${sep}limit=100&cursor=${encodeURIComponent(cursor)}`
      : `${url}${sep}limit=100`

    const res = await fetch(pageUrl, {
      headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`n8n API error: ${res.status} ${res.statusText}`)

    const data = await res.json()
    results.push(...(data.data ?? []))
    cursor = data.nextCursor ?? null
  } while (cursor)

  return results
}

export async function healthCheck(server: ServerConfig): Promise<{ alive: boolean; latencyMs: number }> {
  const start = Date.now()
  try {
    const res = await fetch(`${server.url}/api/v1/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    })
    return { alive: res.ok, latencyMs: Date.now() - start }
  } catch {
    return { alive: false, latencyMs: Date.now() - start }
  }
}

export async function listWorkflows(server: ServerConfig): Promise<N8nWorkflow[]> {
  const list = await fetchAllPages<N8nWorkflow>(`${server.url}/api/v1/workflows?excludePinnedData=true`, server.apiKey)
  return list.map(normalizeWorkflow)
}

export async function listWorkflowsPage(
  server: ServerConfig,
  limit = 30,
  cursor?: string,
): Promise<{ data: N8nWorkflow[]; nextCursor: string | null }> {
  const url = cursor
    ? `${server.url}/api/v1/workflows?excludePinnedData=true&limit=${limit}&cursor=${encodeURIComponent(cursor)}`
    : `${server.url}/api/v1/workflows?excludePinnedData=true&limit=${limit}`
  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`n8n API error: ${res.status}`)
  const json = await res.json()
  return { data: (json.data ?? []).map(normalizeWorkflow), nextCursor: json.nextCursor ?? null }
}

export async function getWorkflow(server: ServerConfig, id: string): Promise<N8nWorkflow> {
  const res = await fetch(`${server.url}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to get workflow: ${res.status}`)
  return normalizeWorkflow(await res.json())
}

export async function createWorkflow(server: ServerConfig, workflow: N8nWorkflow): Promise<N8nWorkflow> {
  const res = await fetch(`${server.url}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(toWritableWorkflow(workflow)),
  })
  if (!res.ok) throw await n8nError(res, 'Failed to create workflow')
  return res.json()
}

export async function deleteWorkflow(server: ServerConfig, id: string): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/workflows/${id}`, {
    method: 'DELETE',
    headers: { 'X-N8N-API-KEY': server.apiKey },
  })
  if (!res.ok) throw new Error(`Failed to delete workflow: ${res.status}`)
}

/**
 * 워크플로우 수정.
 * n8n 2.0+에서는 게시된 워크플로우를 PUT하면 기본적으로 최신 초안이 바로 다시 게시된다.
 * 관리 도구가 남의 미완성 초안을 의도치 않게 라이브로 올리지 않도록 기본값은 publishIfActive=false.
 * (이름·설정 변경은 워크플로우 자체에 바로 반영된다)
 */
export async function updateWorkflow(
  server: ServerConfig,
  id: string,
  workflow: N8nWorkflow,
  options: { publishIfActive?: boolean } = {},
): Promise<N8nWorkflow> {
  const publish = options.publishIfActive ?? false
  const init: RequestInit = {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(toWritableWorkflow(workflow)),
  }
  let res = await fetch(`${server.url}/api/v1/workflows/${id}?publishIfActive=${publish}`, init)
  if (res.status === 400) {
    // n8n 1.x는 publishIfActive 쿼리를 모른다 → 쿼리 없이 재시도
    const text = await res.clone().text()
    if (/publishIfActive|unknown query/i.test(text)) {
      res = await fetch(`${server.url}/api/v1/workflows/${id}`, init)
    }
  }
  if (!res.ok) throw await n8nError(res, 'Failed to update workflow')
  return normalizeWorkflow(await res.json())
}

/** 게시(1.x의 activate). 2.0+는 /publish, 구버전은 /activate로 폴백. */
export async function publishWorkflow(server: ServerConfig, id: string): Promise<void> {
  const headers = { 'X-N8N-API-KEY': server.apiKey, 'Content-Type': 'application/json' }
  let res = await fetch(`${server.url}/api/v1/workflows/${id}/publish`, { method: 'POST', headers, body: '{}' })
  if (res.status === 404 || res.status === 405) {
    res = await fetch(`${server.url}/api/v1/workflows/${id}/activate`, { method: 'POST', headers })
  }
  if (!res.ok) throw await n8nError(res, 'Failed to publish workflow')
}

export async function listUsers(server: ServerConfig): Promise<N8nUser[]> {
  // includeRole=true가 없으면 role이 빠져서 owner/admin 보호(삭제 방지·휴면 정리 제외)가 무력화된다
  const users = await fetchAllPages<N8nUser>(`${server.url}/api/v1/users?includeRole=true`, server.apiKey)
  const now = Date.now()
  return users.map((u) => ({
    ...u,
    daysSinceActive: (u.lastActiveAt ?? u.updatedAt)
      ? Math.floor((now - new Date((u.lastActiveAt ?? u.updatedAt)!).getTime()) / 86400000)
      : undefined,
  }))
}

export async function inviteUser(server: ServerConfig, email: string): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/users`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([{ email, role: 'global:member' }]),
  })
  if (!res.ok) throw new Error(`Failed to invite user: ${res.status}`)
}

export async function deleteUser(server: ServerConfig, id: string): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/users/${id}`, {
    method: 'DELETE',
    headers: { 'X-N8N-API-KEY': server.apiKey },
  })
  if (!res.ok) throw new Error(`Failed to delete user: ${res.status}`)
}

export async function listProjects(server: ServerConfig): Promise<N8nProject[]> {
  const res = await fetch(`${server.url}/api/v1/projects?limit=250`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) return [] // projects API may not exist on older versions
  const json = await res.json()
  return json.data ?? []
}

export async function listCredentials(server: ServerConfig): Promise<N8nCredential[]> {
  return fetchAllPages<N8nCredential>(`${server.url}/api/v1/credentials`, server.apiKey)
}

export async function deleteCredential(server: ServerConfig, id: string): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/credentials/${id}`, {
    method: 'DELETE',
    headers: { 'X-N8N-API-KEY': server.apiKey },
  })
  if (!res.ok) throw new Error(`Failed to delete credential: ${res.status}`)
}

export async function transferWorkflowOwnership(
  server: ServerConfig,
  workflowId: string,
  destinationProjectId: string,
): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/workflows/${workflowId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationProjectId }),
  })
  if (!res.ok) throw new Error(`Failed to transfer workflow: ${res.status}`)
}

export async function transferCredentialOwnership(
  server: ServerConfig,
  credentialId: string,
  destinationProjectId: string,
): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/credentials/${credentialId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationProjectId }),
  })
  if (!res.ok) throw new Error(`Failed to transfer credential: ${res.status}`)
}

export function workflowHasErrorTrigger(workflow: N8nWorkflow): boolean {
  return (workflow.nodes ?? []).some(
    (node: unknown) => (node as { type?: string }).type === 'n8n-nodes-base.errorTrigger'
  )
}

export async function listTags(server: ServerConfig): Promise<{ id: string; name: string }[]> {
  const res = await fetch(`${server.url}/api/v1/tags`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to list tags: ${res.status}`)
  const data = await res.json()
  return data.data ?? data
}

export async function createTag(server: ServerConfig, name: string): Promise<{ id: string; name: string }> {
  const res = await fetch(`${server.url}/api/v1/tags`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error(`Failed to create tag: ${res.status}`)
  return res.json()
}

export async function listExecutions(
  server: ServerConfig,
  filters?: { status?: string; workflowId?: string; limit?: number }
): Promise<N8nExecution[]> {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.workflowId) params.set('workflowId', filters.workflowId)
  params.set('limit', String(filters?.limit ?? 20))

  const res = await fetch(`${server.url}/api/v1/executions?${params.toString()}`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to list executions: ${res.status}`)
  const data = await res.json()
  return data.data ?? data
}

export async function getExecution(server: ServerConfig, id: string): Promise<N8nExecution> {
  const res = await fetch(`${server.url}/api/v1/executions/${id}`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to get execution: ${res.status}`)
  return res.json()
}
