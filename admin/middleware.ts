import { auth } from './auth'
import { NextResponse } from 'next/server'

const ALLOWED_HOST = 'admin.datapopcorn.ai'
const PUBLIC_PATHS = ['/login', '/setup', '/api/auth']

export default auth((req) => {
  const host = req.headers.get('host') ?? ''
  if (host !== ALLOWED_HOST) {
    return new NextResponse(null, { status: 404 })
  }

  const pathname = req.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))
  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
