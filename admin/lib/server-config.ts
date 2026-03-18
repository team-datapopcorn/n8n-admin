import { ServerConfig } from './types'

/**
 * .env에서 서버 목록을 읽어 반환합니다.
 *
 * env 키 규칙:
 *   server1 → SERVER_URL / SERVER_API_KEY / SERVER_NAME
 *   server2 → SERVER2_URL / SERVER2_API_KEY / SERVER2_NAME
 *   server3 → SERVER3_URL / SERVER3_API_KEY / SERVER3_NAME
 *
 * ⚠️ 서버 번호는 연속해야 합니다.
 *    SERVER_URL과 SERVER3_URL은 있지만 SERVER2_URL이 없으면 server3는 무시됩니다.
 *
 * ⚠️ 이 함수는 서버 컴포넌트에서만 호출하세요.
 *    process.env는 클라이언트 컴포넌트에서 접근할 수 없습니다.
 */
export function getServers(): ServerConfig[] {
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
    })
    i++
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
