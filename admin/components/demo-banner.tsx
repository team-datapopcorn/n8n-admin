'use client'

import { useDemoMode } from '@/lib/demo-context'

export function DemoBanner() {
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
      <span className="font-medium">데모 모드</span> — 실제 n8n 서버를 연결하면 이 배너가 사라집니다.
    </div>
  )
}
