import { NextResponse } from 'next/server'
import { getServers } from '@/lib/server-config'
import { runAutoCleanup } from '@/lib/auto-cleanup'
import { getGeminiApiKey, getSlackWebhookUrl } from '@/lib/config-store'
import { sendSlackCleanupReport, sendSlackError } from '@/lib/slack'

// Vercel Cron: 매일 03:00 KST = 18:00 UTC
// vercel.json의 crons 설정과 함께 사용
export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const geminiApiKey = getGeminiApiKey()
  const slackWebhookUrl = getSlackWebhookUrl()

  if (!geminiApiKey) {
    const msg = 'Gemini API 키가 설정되지 않았습니다. Settings에서 입력해주세요.'
    if (slackWebhookUrl) await sendSlackError(slackWebhookUrl, msg).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const servers = getServers()
  if (servers.length === 0) {
    const msg = '서버 설정이 없습니다.'
    if (slackWebhookUrl) await sendSlackError(slackWebhookUrl, msg).catch(() => {})
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const allResults = []
  for (const server of servers) {
    try {
      const result = await runAutoCleanup(server, geminiApiKey)
      allResults.push({ serverId: server.id, serverName: server.name, ...result })
    } catch (err) {
      allResults.push({ serverId: server.id, serverName: server.name, error: String(err) })
    }
  }

  // Slack 알림 전송
  if (slackWebhookUrl) {
    await sendSlackCleanupReport(slackWebhookUrl, allResults, 'cron').catch(() => {})
  }

  return NextResponse.json({ ok: true, results: allResults })
}
