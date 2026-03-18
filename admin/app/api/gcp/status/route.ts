import { NextResponse } from 'next/server'
import { getVmStatus } from '@/lib/gcp-client'

export async function GET() {
  try {
    const status = await getVmStatus()
    return NextResponse.json(status)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
