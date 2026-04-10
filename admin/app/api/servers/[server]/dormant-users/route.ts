import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listUsers } from '@/lib/n8n-client'

export async function GET(req: NextRequest, { params }: { params: Promise<{ server: string }> }) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const daysThreshold = Number(req.nextUrl.searchParams.get('days') ?? '30')

    const users = await listUsers(server)
    const dormant = users.filter((u) => {
      if (u.role === 'global:owner') return false
      return (u.daysSinceActive ?? 999) >= daysThreshold
    })

    return NextResponse.json({
      totalUsers: users.length,
      dormantCount: dormant.length,
      daysThreshold,
      dormant: dormant.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        daysSinceActive: u.daysSinceActive,
        isPending: u.isPending,
      })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
