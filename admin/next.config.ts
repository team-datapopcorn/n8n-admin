import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 서버 컴포넌트에서는 process.env로 직접 접근 가능합니다.
  // 클라이언트 컴포넌트에서 env를 사용해야 한다면 아래 env 블록을 활용하세요.
  // (현재는 서버 컴포넌트에서만 env를 읽으므로 별도 노출 불필요)
}

export default nextConfig
