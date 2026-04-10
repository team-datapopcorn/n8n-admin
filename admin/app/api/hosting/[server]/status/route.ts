import { NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { createProvider } from '@/lib/hosting'

export async function GET(_req: Request, { params }: { params: Promise<{ server: string }> }) {
  const { server: serverId } = await params
  try {
    const server = getServer(serverId)
    if (!server.hosting) {
      return NextResponse.json({ error: '이 서버에 호스팅이 설정되지 않았습니다.' }, { status: 404 })
    }
    const provider = createProvider(server.hosting)
    const status = await provider.getStatus()
    return NextResponse.json({ ...status, provider: provider.id, providerName: provider.name, capabilities: provider.capabilities })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
