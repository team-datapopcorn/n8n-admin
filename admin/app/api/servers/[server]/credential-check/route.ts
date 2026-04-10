import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listCredentials } from '@/lib/n8n-client'
import { isAbnormalCredentialName } from '@/lib/auto-cleanup'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const credentials = await listCredentials(server)

    const abnormal = credentials.filter((c) => isAbnormalCredentialName(c.name))

    return NextResponse.json({
      totalCredentials: credentials.length,
      abnormalCount: abnormal.length,
      abnormal: abnormal.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        updatedAt: c.updatedAt,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
