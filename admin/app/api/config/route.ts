import { NextResponse } from 'next/server'
import { isGeminiConfigured, setGeminiApiKey } from '@/lib/config-store'

// GET: 설정 상태 조회 (키 값 자체는 반환하지 않음)
export async function GET() {
  return NextResponse.json({
    geminiConfigured: isGeminiConfigured(),
    geminiSource: process.env.GEMINI_API_KEY ? 'env' : 'config',
  })
}

// POST: Gemini API 키 저장
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const { geminiApiKey } = body as { geminiApiKey?: string }

  if (!geminiApiKey || geminiApiKey.trim().length === 0) {
    return NextResponse.json({ error: 'geminiApiKey가 비어 있습니다.' }, { status: 400 })
  }

  // 키를 .config/keys.json에 저장
  setGeminiApiKey(geminiApiKey.trim())

  return NextResponse.json({ ok: true })
}
