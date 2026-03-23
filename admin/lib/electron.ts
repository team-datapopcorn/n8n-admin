export interface ElectronAPI {
  getServers: () => Promise<ElectronServer[]>
  saveServers: (servers: ElectronServer[]) => Promise<void>
  getSessionPassword: () => Promise<string>
  testConnection: (url: string, apiKey: string) => Promise<{ ok: boolean; error?: string }>
  isElectron: boolean
}

export interface ElectronServer {
  id: string
  name: string
  url: string
  apiKey: string
  description?: string
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
