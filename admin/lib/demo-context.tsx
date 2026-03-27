'use client'

import React, { createContext, useContext, useState } from 'react'

interface DemoModeContextValue {
  isDemoMode: boolean
  enableDemoMode: () => void
  disableDemoMode: () => void
}

const DemoModeContext = createContext<DemoModeContextValue | null>(null)

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)

  const enableDemoMode = () => setIsDemoMode(true)
  const disableDemoMode = () => setIsDemoMode(false)

  return (
    <DemoModeContext.Provider value={{ isDemoMode, enableDemoMode, disableDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  )
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext)
  if (!ctx) {
    throw new Error('useDemoMode must be used within a DemoProvider')
  }
  return ctx
}
