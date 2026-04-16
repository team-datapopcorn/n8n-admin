import { NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { runAutoCleanup } from '@/lib/auto-cleanup'
import { getGeminiApiKey, getSlackWebhookUrl } from '@/lib/config-store'
import { sendSlackCleanupReport } from '@/lib/slack'

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
  const dryRun: boolean = body.dryRun ?? false

  try {
    const server = getServer(serverId)
    const result = await runAutoCleanup(server, geminiApiKey, dryRun)

    // 수동 실행 시에도 Slack 알림 (dry run 제외)
    if (!dryRun) {
      const slackWebhookUrl = getSlackWebhookUrl()
      if (slackWebhookUrl) {
        await sendSlackCleanupReport(
          slackWebhookUrl,
          [{ serverId, serverName: server.name, ...result }],
          'manual',
        ).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, serverId, dryRun, ...result })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
