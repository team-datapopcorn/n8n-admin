import { NextRequest, NextResponse } from 'next/server'
import { resizeVm } from '@/lib/gcp-client'

export async function POST(req: NextRequest) {
  try {
    const { machineType } = await req.json()
    if (!machineType) return NextResponse.json({ error: 'machineType required' }, { status: 400 })
    await resizeVm(machineType)
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
