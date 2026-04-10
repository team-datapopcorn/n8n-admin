/**
 * AWS EC2 Provider (스텁)
 *
 * 환경변수:
 *   SERVER_HOSTING=aws
 *   SERVER_AWS_REGION=ap-northeast-2
 *   SERVER_AWS_INSTANCE_ID=i-0123456789abcdef0
 *   SERVER_AWS_ACCESS_KEY_ID=...
 *   SERVER_AWS_SECRET_ACCESS_KEY=...
 *
 * 구현 시 @aws-sdk/client-ec2 사용 예정
 */

import { HostingProvider } from '../types'

export function createAwsProvider(_params: Record<string, string>): HostingProvider {
  throw new Error('AWS Provider는 아직 구현되지 않았습니다. 기여를 환영합니다!')
}
