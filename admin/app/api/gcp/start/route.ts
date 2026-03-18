import { NextResponse } from 'next/server'
import { startVm } from '@/lib/gcp-client'

export async function POST() {
  try {
    await startVm()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
