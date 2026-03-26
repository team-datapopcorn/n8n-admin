import { NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { runAutoCleanup } from '@/lib/auto-cleanup'
import { getGeminiApiKey } from '@/lib/config-store'

export const maxDuration = 300

export async function POST(req: Request) {
  const geminiApiKey = getGeminiApiKey()
  if (!geminiApiKey) {
    return NextResponse.json(
      { error: 'Gemini API 키가 설정되지 않았습니다. Settings에서 입력해주세요.' },
      { status: 500 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const serverId: string = body.serverId ?? 'server1'

  try {
    const server = getServer(serverId)
    const result = await runAutoCleanup(server, geminiApiKey)
    return NextResponse.json({ ok: true, serverId, ...result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
