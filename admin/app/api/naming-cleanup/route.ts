import { NextRequest, NextResponse } from 'next/server'
import { getServer, getServers } from '@/lib/server-config'
import { runAutoCleanup } from '@/lib/auto-cleanup'
import { getGeminiApiKey } from '@/lib/config-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { serverId?: string }
    const geminiApiKey = getGeminiApiKey()

    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 400 })
    }

    const serverIds = body.serverId
      ? [body.serverId]
      : getServers().map((s) => s.id)

    const results = []
    for (const sid of serverIds) {
      const server = getServer(sid)
      const result = await runAutoCleanup(server, geminiApiKey)
      results.push({
        serverId: sid,
        serverName: server.name,
        renamed: result.renamed,
        skipped: result.skipped.length,
        errors: result.errors,
        credentialWarnings: result.credentialWarnings.length,
        conventionViolations: result.conventionViolations.length,
      })
    }

    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
