import { NextResponse } from 'next/server'
import { stopVm } from '@/lib/gcp-client'

export async function POST() {
  try {
    await stopVm()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
