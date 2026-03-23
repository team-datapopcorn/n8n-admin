import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServers: (servers: unknown[]) => ipcRenderer.invoke('save-servers', servers),
  getSessionPassword: () => ipcRenderer.invoke('get-session-password'),
  testConnection: (url: string, apiKey: string) => ipcRenderer.invoke('test-connection', url, apiKey),
  isElectron: true,
})
