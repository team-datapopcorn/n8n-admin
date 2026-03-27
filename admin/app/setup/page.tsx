'use client'

import { useRouter } from 'next/navigation'
import { SetupWizard } from '@/components/setup-wizard'
import { DemoProvider, useDemoMode } from '@/lib/demo-context'

function SetupContent() {
  const router = useRouter()
  const { enableDemoMode } = useDemoMode()

  async function handleComplete(server: { name: string; url: string; apiKey: string }) {
    if (window.electronAPI?.isElectron) {
      await window.electronAPI.saveServers([{
        id: 'server1',
        ...server,
      }])
    } else {
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

export default function SetupPage() {
  return (
    <DemoProvider>
      <SetupContent />
    </DemoProvider>
  )
}
