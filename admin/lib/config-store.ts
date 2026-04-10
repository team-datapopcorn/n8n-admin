/**
 * 앱 설정 파일 저장소 (admin/.config/keys.json)
 *
 * .env 편집 없이 UI에서 설정값을 저장하고 불러올 수 있습니다.
 * 우선순위: process.env (Vercel/시스템 env) > .config/keys.json (UI 저장값)
 *
 * ⚠️ 서버 컴포넌트 또는 API Route에서만 사용하세요.
 */

import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), '.config', 'keys.json')

export interface AppConfig {
  geminiApiKey?: string
  cronSecret?: string
  /** 자동 정리 Cron 시간 (KST, 예: "03:00") */
  cleanupTime?: string
  /** 자동 정리 대상 서버 ID (미설정 시 전체) */
  cleanupServerId?: string
  /** 네이밍 컨벤션 검사 활성화 */
  namingConventionEnabled?: boolean
  /** Slack Webhook URL (알림용) */
  slackWebhookUrl?: string
  /** 비활성 워크플로우 기준 일수 */
  staleDays?: number
  /** 휴면 유저 기준 일수 */
  dormantDays?: number
}

function readConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch {
    // 파일 없거나 파싱 오류 → 빈 객체
  }
  return {}
}

function writeConfig(config: AppConfig): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8')
}

// ─── Gemini ─────────────────────────────────────────────────────

export function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || readConfig().geminiApiKey || undefined
}

export function setGeminiApiKey(key: string): void {
  const config = readConfig()
  config.geminiApiKey = key
  writeConfig(config)
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey())
}

// ─── Cron Secret ────────────────────────────────────────────────

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET || readConfig().cronSecret || undefined
}

export function setCronSecret(secret: string): void {
  const config = readConfig()
  config.cronSecret = secret
  writeConfig(config)
}

// ─── Slack Webhook ──────────────────────────────────────────────

export function getSlackWebhookUrl(): string | undefined {
  return process.env.SLACK_WEBHOOK_URL || readConfig().slackWebhookUrl || undefined
}

export function setSlackWebhookUrl(url: string): void {
  const config = readConfig()
  config.slackWebhookUrl = url
  writeConfig(config)
}

// ─── 전체 설정 조회/저장 ────────────────────────────────────────

export function getAppConfig(): AppConfig {
  const saved = readConfig()
  return {
    ...saved,
    geminiApiKey: getGeminiApiKey(),
    cronSecret: getCronSecret(),
    slackWebhookUrl: getSlackWebhookUrl(),
    cleanupTime: saved.cleanupTime ?? '03:00',
    cleanupServerId: saved.cleanupServerId,
    namingConventionEnabled: saved.namingConventionEnabled ?? true,
    staleDays: saved.staleDays ?? 30,
    dormantDays: saved.dormantDays ?? 30,
  }
}

export function updateAppConfig(updates: Partial<AppConfig>): void {
  const config = readConfig()
  Object.assign(config, updates)
  writeConfig(config)
}
