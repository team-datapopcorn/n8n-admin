import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listCredentials } from '@/lib/n8n-client'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const credentials = await listCredentials(server)
    return NextResponse.json(credentials)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
