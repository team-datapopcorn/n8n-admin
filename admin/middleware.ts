export { auth as middleware } from './auth'

export const config = {
  matcher: ['/((?!login|setup|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
