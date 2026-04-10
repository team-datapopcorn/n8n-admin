import { NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { createProvider } from '@/lib/hosting'

export async function POST(req: Request, { params }: { params: Promise<{ server: string }> }) {
  const { server: serverId } = await params
  try {
    const { spec } = (await req.json()) as { spec: string }
    if (!spec) {
      return NextResponse.json({ error: 'spec 필드가 필요합니다.' }, { status: 400 })
    }

    const server = getServer(serverId)
    if (!server.hosting) {
      return NextResponse.json({ error: '이 서버에 호스팅이 설정되지 않았습니다.' }, { status: 404 })
    }

    const provider = createProvider(server.hosting)
    if (!provider.resize) {
      return NextResponse.json({ error: `이 Provider(${provider.name})는 리사이즈를 지원하지 않습니다.` }, { status: 400 })
    }

    await provider.resize(spec)
    return NextResponse.json({ success: true, spec })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
