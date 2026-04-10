/**
 * Hosting Provider 레지스트리
 *
 * ServerConfig.hosting 설정을 기반으로
 * 해당하는 Provider 인스턴스를 생성합니다.
 */

import { HostingConfig, HostingType } from '../types'
import { HostingProvider } from './types'
import { createGcpProvider } from './providers/gcp'

type ProviderFactory = (params: Record<string, string>) => HostingProvider

const factories = new Map<HostingType, ProviderFactory>([
  ['gcp', createGcpProvider],
  // ['aws', createAwsProvider],
  // ['railway', createRailwayProvider],
  // ['hostinger', createHostingerProvider],
])

export function createProvider(config: HostingConfig): HostingProvider {
  const factory = factories.get(config.type)
  if (!factory) {
    throw new Error(
      `지원하지 않는 호스팅 타입: ${config.type}. 지원: ${[...factories.keys()].join(', ')}`,
    )
  }
  return factory(config.params)
}
