/**
 * Hostinger VPS Provider (스텁)
 *
 * 환경변수:
 *   SERVER_HOSTING=hostinger
 *   SERVER_HOSTINGER_VPS_ID=...
 *   SERVER_HOSTINGER_API_TOKEN=...
 *
 * 구현 시 Hostinger VPS API 사용 예정
 */

import { HostingProvider } from '../types'

export function createHostingerProvider(_params: Record<string, string>): HostingProvider {
  throw new Error('Hostinger Provider는 아직 구현되지 않았습니다. 기여를 환영합니다!')
}
