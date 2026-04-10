import { NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { createProvider } from '@/lib/hosting'

const VALID_ACTIONS = ['start', 'stop', 'restart', 'redeploy'] as const
type Action = typeof VALID_ACTIONS[number]

export async function POST(req: Request, { params }: { params: Promise<{ server: string }> }) {
  const { server: serverId } = await params
  try {
    const { action } = (await req.json()) as { action: string }
    if (!VALID_ACTIONS.includes(action as Action)) {
      return NextResponse.json({ error: `잘못된 액션: ${action}. 가능: ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
    }

    const server = getServer(serverId)
    if (!server.hosting) {
      return NextResponse.json({ error: '이 서버에 호스팅이 설정되지 않았습니다.' }, { status: 404 })
    }

    const provider = createProvider(server.hosting)
    const fn = provider[action as Action]
    if (!fn) {
      return NextResponse.json({ error: `이 Provider(${provider.name})는 ${action}을 지원하지 않습니다.` }, { status: 400 })
    }

    await fn.call(provider)
    return NextResponse.json({ success: true, action })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
