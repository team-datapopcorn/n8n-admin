import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Providers from './providers'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

const appName = process.env.APP_NAME ?? 'n8n Admin'

export const metadata: Metadata = {
  title: appName,
  description: 'n8n 서버 통합 관리 대시보드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`}>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
