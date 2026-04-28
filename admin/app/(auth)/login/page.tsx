'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  // Electron auto-login
  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      setLoading(true)
      window.electronAPI.getSessionPassword().then(async (pw) => {
        const result = await signIn('credentials', { password: pw, redirect: false })
        if (result?.error) {
          setLoading(false)
        } else {
          router.push('/')
        }
      })
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const result = await signIn('credentials', { password, redirect: false })
    if (result?.error) {
      setError('비밀번호가 올바르지 않습니다.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  // Show loading state during Electron auto-login
  if (typeof window !== 'undefined' && window.electronAPI?.isElectron && loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <p className="text-muted-foreground">로그인 중...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">n8n Admin</CardTitle>
          <CardDescription>n8n 서버 관리 대시보드</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="비밀번호 입력"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '로그인 중...' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
