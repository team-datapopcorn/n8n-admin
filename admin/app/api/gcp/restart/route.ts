import { NextResponse } from 'next/server'
import { restartVm } from '@/lib/gcp-client'

export async function POST() {
  try {
    await restartVm()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
