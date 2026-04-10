import fs from 'fs'
import { ServerConfig, HostingConfig, HostingType } from './types'

/**
 * 환경변수에서 호스팅 설정을 읽습니다.
 *
 * 예시:
 *   SERVER_HOSTING=gcp
 *   SERVER_GCP_PROJECT_ID=my-project
 *   SERVER_GCP_ZONE=asia-northeast3-a
 *   SERVER_GCP_INSTANCE_NAME=n8n-vm
 *   SERVER_GCP_SERVICE_ACCOUNT_KEY=base64...
 *
 * 글로벌 GCP 환경변수 폴백:
 *   GCP_PROJECT_ID, GCP_ZONE, GCP_INSTANCE_NAME, GCP_SERVICE_ACCOUNT_KEY
 */
function readHostingConfig(prefix: string): HostingConfig | undefined {
  const type = (process.env[`${prefix}_HOSTING`] ?? '').toLowerCase() as HostingType

  if (type && type !== 'none') {
    const providerPrefix = `${prefix}_${type.toUpperCase().replace('-', '_')}_`
    const params: Record<string, string> = {}

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(providerPrefix) && value) {
        const paramKey = key
          .slice(providerPrefix.length)
          .toLowerCase()
          .replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        params[paramKey] = value
      }
    }

    return { type, params }
  }

  return undefined
}

/**
 * 글로벌 GCP 환경변수(GCP_PROJECT_ID 등)로 GCP 호스팅 설정을 생성합니다.
 * 기존 .env 호환용 — named env 모드의 GCP 서버에만 적용됩니다.
 */
function readGlobalGcpHosting(): HostingConfig | undefined {
  if (!process.env.GCP_PROJECT_ID) return undefined
  const params: Record<string, string> = {}
  if (process.env.GCP_PROJECT_ID) params.projectId = process.env.GCP_PROJECT_ID
  if (process.env.GCP_ZONE) params.zone = process.env.GCP_ZONE
  if (process.env.GCP_INSTANCE_NAME) params.instanceName = process.env.GCP_INSTANCE_NAME
  if (process.env.GCP_SERVICE_ACCOUNT_KEY) params.serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY
  return { type: 'gcp', params }
}

/**
 * .env 또는 JSON 파일에서 서버 목록을 읽어 반환합니다.
 *
 * Electron 환경: ELECTRON_CONFIG_PATH가 설정되면 해당 JSON 파일에서 읽음.
 * 웹 환경: process.env에서 SERVER_URL, SERVER_API_KEY 등을 읽음.
 *
 * ⚠️ 이 함수는 서버 컴포넌트에서만 호출하세요.
 */
export function getServers(): ServerConfig[] {
  // Electron: JSON 파일에서 읽기
  const configPath = process.env.ELECTRON_CONFIG_PATH
  if (configPath) {
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        return data.servers ?? []
      }
    } catch (err) {
      console.error('Failed to read Electron config:', err)
    }
    return []
  }

  // 웹: .env에서 읽기
  const servers: ServerConfig[] = []

  let i = 1
  while (true) {
    const prefix = i === 1 ? 'SERVER' : `SERVER${i}`
    const url = process.env[`${prefix}_URL`]
    if (!url) break

    servers.push({
      id: `server${i}`,
      name: process.env[`${prefix}_NAME`] ?? `Server ${i}`,
      url,
      apiKey: process.env[`${prefix}_API_KEY`] ?? '',
      description: process.env[`${prefix}_DESCRIPTION`],
      hosting: readHostingConfig(prefix),
    })
    i++
  }

  if (servers.length > 0) return servers

  // 폴백: CLOUD_URL / GCP_URL / RAILWAY_URL 명명 규칙 지원
  const namedEnvs: { key: string; id: string; name: string; description: string }[] = [
    { key: 'CLOUD', id: 'cloud', name: 'Cloud', description: '' },
    { key: 'GCP', id: 'gcp-vm', name: 'GCP VM', description: '' },
    { key: 'RAILWAY', id: 'railway', name: 'Railway', description: '' },
  ]
  for (const s of namedEnvs) {
    const url = process.env[`${s.key}_URL`]
    if (url) {
      // 명시적 호스팅 설정 우선, GCP 서버에만 글로벌 GCP 폴백 적용
      const hosting = readHostingConfig(s.key)
        ?? (s.key === 'GCP' ? readGlobalGcpHosting() : undefined)
      servers.push({
        id: s.id,
        name: process.env[`${s.key}_NAME`] ?? s.name,
        url,
        apiKey: process.env[`${s.key}_API_KEY`] ?? '',
        description: process.env[`${s.key}_DESCRIPTION`] ?? s.description,
        hosting,
      })
    }
  }

  return servers
}

/**
 * 특정 서버 ID로 서버 설정을 가져옵니다.
 * 없는 경우 에러를 던집니다.
 */
export function getServer(id: string): ServerConfig {
  const servers = getServers()
  const server = servers.find((s) => s.id === id)
  if (!server) throw new Error(`Unknown server: ${id}. Available: ${servers.map((s) => s.id).join(', ')}`)
  return server
}
