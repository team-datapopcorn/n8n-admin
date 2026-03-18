import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { deleteCredential } from '@/lib/n8n-client'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ server: string; id: string }> }) {
  try {
    const { server: serverId, id } = await params
    const server = getServer(serverId)
    await deleteCredential(server, id)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
