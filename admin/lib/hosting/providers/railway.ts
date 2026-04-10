/**
 * Railway Provider (스텁)
 *
 * 환경변수:
 *   SERVER_HOSTING=railway
 *   SERVER_RAILWAY_PROJECT_ID=...
 *   SERVER_RAILWAY_SERVICE_ID=...
 *   SERVER_RAILWAY_API_TOKEN=...
 *
 * 구현 시 Railway GraphQL API 사용 예정
 * https://docs.railway.com/reference/public-api
 */

import { HostingProvider } from '../types'

export function createRailwayProvider(_params: Record<string, string>): HostingProvider {
  throw new Error('Railway Provider는 아직 구현되지 않았습니다. 기여를 환영합니다!')
}
