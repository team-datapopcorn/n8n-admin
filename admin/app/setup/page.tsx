'use client'

import { useRouter } from 'next/navigation'
import { SetupWizard } from '@/components/setup-wizard'
import { useDemoMode } from '@/lib/demo-context'

export default function SetupPage() {
  const router = useRouter()
  const { enableDemoMode } = useDemoMode()

  async function handleComplete(server: { name: string; url: string; apiKey: string }) {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.saveServers([{
        id: 'server1',
        ...server,
      }])
      // Electron main process restarts Next.js and reloads the window automatically.
    } else {
      // Web: redirect to dashboard (assumes .env is already configured)
      router.push('/')
    }
  }

  function handleDemoMode() {
    enableDemoMode()
    router.push('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <SetupWizard onComplete={handleComplete} onDemoMode={handleDemoMode} />
    </div>
  )
}
