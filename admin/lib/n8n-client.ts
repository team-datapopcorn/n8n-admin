import { ServerConfig, N8nWorkflow, N8nUser, N8nCredential } from './types'

async function fetchAllPages<T>(url: string, apiKey: string): Promise<T[]> {
  const results: T[] = []
  let cursor: string | null = null

  do {
    const pageUrl: string = cursor
      ? `${url}?limit=100&cursor=${encodeURIComponent(cursor)}`
      : `${url}?limit=100`

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
  return fetchAllPages<N8nWorkflow>(`${server.url}/api/v1/workflows`, server.apiKey)
}

export async function listWorkflowsPage(
  server: ServerConfig,
  limit = 30,
  cursor?: string,
): Promise<{ data: N8nWorkflow[]; nextCursor: string | null }> {
  const url = cursor
    ? `${server.url}/api/v1/workflows?limit=${limit}&cursor=${encodeURIComponent(cursor)}`
    : `${server.url}/api/v1/workflows?limit=${limit}`
  const res = await fetch(url, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`n8n API error: ${res.status}`)
  const json = await res.json()
  return { data: json.data ?? [], nextCursor: json.nextCursor ?? null }
}

export async function getWorkflow(server: ServerConfig, id: string): Promise<N8nWorkflow> {
  const res = await fetch(`${server.url}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': server.apiKey, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Failed to get workflow: ${res.status}`)
  return res.json()
}

export async function createWorkflow(server: ServerConfig, workflow: N8nWorkflow): Promise<N8nWorkflow> {
  // import.sh 패턴: id, createdAt, updatedAt, versionId 제거
  const { id: _id, createdAt: _c, updatedAt: _u, versionId: _v, ...body } = workflow
  const res = await fetch(`${server.url}/api/v1/workflows`, {
    method: 'POST',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to create workflow: ${res.status}`)
  return res.json()
}

export async function deleteWorkflow(server: ServerConfig, id: string): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/workflows/${id}`, {
    method: 'DELETE',
    headers: { 'X-N8N-API-KEY': server.apiKey },
  })
  if (!res.ok) throw new Error(`Failed to delete workflow: ${res.status}`)
}

export async function listUsers(server: ServerConfig): Promise<N8nUser[]> {
  const users = await fetchAllPages<N8nUser>(`${server.url}/api/v1/users`, server.apiKey)
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
