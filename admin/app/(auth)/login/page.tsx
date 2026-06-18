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
  const [showReset, setShowReset] = useState(false)
  const [resetting, setResetting] = useState(false)
  const router = useRouter()
  const isElectron = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).electronAPI

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

  async function handleReset() {
    if (isElectron) {
      setResetting(true)
      const api = (window as unknown as { electronAPI: { resetSession: () => Promise<void> } }).electronAPI
      await api.resetSession()
      // 서버 재시작 후 페이지가 자동 리로드되므로 별도 처리 불필요
    }
  }

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
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowReset(!showReset)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
            {showReset && (
              <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-2 text-muted-foreground">
                {isElectron ? (
                  <>
                    <p>앱 세션을 재시작하면 자동으로 로그인됩니다.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={resetting}
                      onClick={handleReset}
                    >
                      {resetting ? '재시작 중...' : '세션 재시작'}
                    </Button>
                  </>
                ) : (
                  <p>
                    서버의 <code className="bg-muted px-1 rounded">.env</code> 파일에서{' '}
                    <code className="bg-muted px-1 rounded">ADMIN_PASSWORD</code> 값을 확인하세요.
                  </p>
                )}
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
