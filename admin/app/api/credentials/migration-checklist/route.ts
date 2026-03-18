import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listCredentials } from '@/lib/n8n-client'

export async function POST(req: NextRequest) {
  try {
    const { fromServer, toServer } = await req.json()
    const src = getServer(fromServer)
    const dst = getServer(toServer)

    const [srcCreds, dstCreds] = await Promise.all([
      listCredentials(src),
      listCredentials(dst),
    ])

    const srcKeys = new Map(srcCreds.map((c) => [`${c.type}:${c.name}`, c]))
    const dstKeys = new Map(dstCreds.map((c) => [`${c.type}:${c.name}`, c]))

    const onlyInSrc = srcCreds.filter((c) => !dstKeys.has(`${c.type}:${c.name}`))
    const onlyInDst = dstCreds.filter((c) => !srcKeys.has(`${c.type}:${c.name}`))
    const inBoth = srcCreds.filter((c) => dstKeys.has(`${c.type}:${c.name}`))

    return NextResponse.json({ onlyInSrc, onlyInDst, inBoth })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
