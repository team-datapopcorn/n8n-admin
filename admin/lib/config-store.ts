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

interface AppConfig {
  geminiApiKey?: string
  cronSecret?: string
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

/**
 * Gemini API 키 반환.
 * process.env.GEMINI_API_KEY 우선, 없으면 .config/keys.json에서 읽음.
 */
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
