import { NextResponse } from 'next/server'
import {
  isGeminiConfigured, setGeminiApiKey,
  getCronSecret, setCronSecret,
  getSlackWebhookUrl, setSlackWebhookUrl,
  getAppConfig, updateAppConfig,
  type AppConfig,
} from '@/lib/config-store'
import { getServers } from '@/lib/server-config'

// GET: 설정 상태 조회 (키 값은 마스킹)
export async function GET() {
  const config = getAppConfig()
  const servers = getServers()

  return NextResponse.json({
    // 배포 환경 정보
    isVercel: Boolean(process.env.VERCEL),
    // API 키 상태 (값은 숨김)
    geminiConfigured: isGeminiConfigured(),
    geminiSource: process.env.GEMINI_API_KEY ? 'env' : config.geminiApiKey ? 'config' : null,
    cronSecretConfigured: Boolean(getCronSecret()),
    cronSecretSource: process.env.CRON_SECRET ? 'env' : config.cronSecret ? 'config' : null,
    slackConfigured: Boolean(getSlackWebhookUrl()),
    slackSource: process.env.SLACK_WEBHOOK_URL ? 'env' : config.slackWebhookUrl ? 'config' : null,
    // 일반 설정
    cleanupTime: config.cleanupTime,
    cleanupServerId: config.cleanupServerId,
    namingConventionEnabled: config.namingConventionEnabled,
    staleDays: config.staleDays,
    dormantDays: config.dormantDays,
    // 서버 목록 (설정 UI에서 참조)
    servers: servers.map((s) => ({ id: s.id, name: s.name })),
  })
}

// POST: 설정 저장
export async function POST(req: Request) {
  // Vercel 서버리스 환경에서는 파일 시스템 쓰기 불가
  if (process.env.VERCEL) {
    return NextResponse.json(
      { error: 'Vercel 환경에서는 UI 설정 저장이 지원되지 않습니다. Vercel 대시보드에서 환경변수를 설정해주세요.', vercel: true },
      { status: 400 },
    )
  }

  const body = (await req.json().catch(() => ({}))) as Partial<AppConfig>

  // API 키 저장 (개별 처리)
  if (body.geminiApiKey !== undefined) {
    if (body.geminiApiKey.trim()) setGeminiApiKey(body.geminiApiKey.trim())
  }
  if (body.cronSecret !== undefined) {
    if (body.cronSecret.trim()) setCronSecret(body.cronSecret.trim())
  }
  if (body.slackWebhookUrl !== undefined) {
    setSlackWebhookUrl(body.slackWebhookUrl.trim())
  }

  // 일반 설정 저장
  const generalUpdates: Partial<AppConfig> = {}
  if (body.cleanupTime !== undefined) generalUpdates.cleanupTime = body.cleanupTime
  if (body.cleanupServerId !== undefined) generalUpdates.cleanupServerId = body.cleanupServerId
  if (body.namingConventionEnabled !== undefined) generalUpdates.namingConventionEnabled = body.namingConventionEnabled
  if (body.staleDays !== undefined) generalUpdates.staleDays = body.staleDays
  if (body.dormantDays !== undefined) generalUpdates.dormantDays = body.dormantDays

  if (Object.keys(generalUpdates).length > 0) {
    updateAppConfig(generalUpdates)
  }

  return NextResponse.json({ ok: true })
}
