# n8n Admin Electron Desktop App — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the existing Next.js admin dashboard as a macOS Electron desktop app (DMG) so non-developers can manage n8n servers by entering only a URL and API key.

**Architecture:** Electron main process launches the Next.js standalone build as a forked child process on a random port, with server config passed via a JSON file. A preload script exposes IPC for reading/writing server settings from electron-store. Auth uses a per-session random password with auto-login via IPC.

**Tech Stack:** Electron, electron-store, electron-builder, get-port, Next.js 16 standalone mode

**Spec:** `docs/superpowers/specs/2026-03-23-electron-desktop-app-design.md`

---

## File Map

### New files (desktop/)

| File | Responsibility |
|------|----------------|
| `desktop/main.ts` | Electron main process: app lifecycle, Next.js child process, IPC handlers, window management |
| `desktop/preload.ts` | Context bridge: exposes `electronAPI` to renderer (getServers, saveServers, getSessionPassword, isElectron) |
| `desktop/tsconfig.json` | TypeScript config for Electron code (CommonJS output) |

### New files (admin/)

| File | Responsibility |
|------|----------------|
| `admin/app/setup/page.tsx` | First-run setup page: server URL + API key form, connection test, auto-login after save |
| `admin/app/setup/layout.tsx` | Minimal layout for setup page (no sidebar, no auth) |
| `admin/app/(dashboard)/settings/page.tsx` | Server management page inside dashboard: add/edit/delete servers |
| `admin/app/(dashboard)/settings/settings-client.tsx` | Client component for settings UI with Electron IPC |
| `admin/lib/electron.ts` | Type declarations for `window.electronAPI` |

### New files (root)

| File | Responsibility |
|------|----------------|
| `electron-builder.yml` | electron-builder config for macOS DMG |
| `scripts/build-desktop.sh` | Build script: Next.js build → copy standalone → compile Electron → build DMG |

### Modified files

| File | Change |
|------|--------|
| `admin/lib/server-config.ts` | Add JSON file reading branch when `ELECTRON_CONFIG_PATH` is set |
| `admin/middleware.ts` | Add `setup` to auth exception matcher |
| `admin/next.config.ts` | Add `output: 'standalone'` |
| `admin/components/layout/sidebar.tsx` | Add Settings nav item (Electron only) |
| `admin/app/(dashboard)/page.tsx` | Update empty-state message for Electron context |
| `.gitignore` | Add `desktop/dist/`, `dist/`, `build/standalone/` |

---

## Task 1: Project scaffolding and Electron dependencies

**Files:**
- Create: `desktop/tsconfig.json`
- Create: `admin/lib/electron.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Install Electron and related dependencies at repo root**

Since the project has no root `package.json`, we need to create one for the Electron app. The `admin/` directory keeps its own `package.json` for Next.js.

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
# Edit package.json: set "name": "n8n-admin-desktop" to avoid conflict with admin/package.json
npm install --save electron-store@8 get-port
npm install --save-dev electron electron-builder typescript @types/node
```

After install, edit the generated `package.json` to set the correct metadata:

```json
{
  "name": "n8n-admin-desktop",
  "version": "1.0.0",
  "private": true,
  "main": "desktop/dist/main.js",
  "scripts": {
    "desktop:build": "./scripts/build-desktop.sh",
    "desktop:dev": "npx tsc -p desktop/tsconfig.json && electron .",
    "electron:compile": "tsc -p desktop/tsconfig.json"
  },
  "dependencies": {
    "electron-store": "...",
    "get-port": "..."
  },
  "devDependencies": {
    "electron": "...",
    "electron-builder": "...",
    "typescript": "...",
    "@types/node": "..."
  }
}
```

Keep the installed versions — just update `name`, `version`, `private`, `main`, and `scripts`.

- [ ] **Step 2: Create `desktop/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": false,
    "sourceMap": true
  },
  "include": ["*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `admin/lib/electron.ts`**

Type-only declarations for the Electron IPC bridge (no runtime code). This file augments `Window` globally so client components can call `window.electronAPI` with type safety. It works in both server and client contexts since it only contains types.

```typescript
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
```

- [ ] **Step 4: Update `.gitignore`**

Add these lines to the end of `/Users/popcorn/Documents/Github/n8n-admin/.gitignore`:

```
# Electron
desktop/dist/
dist/
build/standalone/
*.dmg
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
# Create a minimal main.ts to test compilation
echo "console.log('test')" > desktop/main.ts
npx tsc -p desktop/tsconfig.json
ls desktop/dist/main.js
rm desktop/main.ts desktop/dist/main.js
```

Expected: `desktop/dist/main.js` is created successfully.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json desktop/tsconfig.json admin/lib/electron.ts .gitignore
git commit -m "chore: scaffold Electron project with dependencies and types"
```

---

## Task 2: Electron main process

**Files:**
- Create: `desktop/main.ts`

- [ ] **Step 1: Write `desktop/main.ts`**

```typescript
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import Store from 'electron-store'
import { fork, ChildProcess } from 'child_process'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

// get-port is ESM-only, use dynamic import
async function getAvailablePort(): Promise<number> {
  const { default: getPort } = await import('get-port')
  return getPort()
}

interface ServerEntry {
  id: string
  name: string
  url: string
  apiKey: string
  description?: string
}

const store = new Store<{
  servers: ServerEntry[]
  nextauthSecret: string
}>({
  schema: {
    servers: {
      type: 'array' as const,
      default: [],
      items: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const },
          name: { type: 'string' as const },
          url: { type: 'string' as const },
          apiKey: { type: 'string' as const },
          description: { type: 'string' as const },
        },
        required: ['id', 'name', 'url', 'apiKey'],
      },
    },
    nextauthSecret: {
      type: 'string' as const,
      default: '',
    },
  },
})

// Generate persistent NEXTAUTH_SECRET on first launch
if (!store.get('nextauthSecret')) {
  store.set('nextauthSecret', crypto.randomBytes(32).toString('base64'))
}

let nextProcess: ChildProcess | null = null
let currentPort: number | null = null
let sessionPassword: string = ''
let mainWindow: BrowserWindow | null = null

function writeConfigFile(): string {
  const configPath = path.join(app.getPath('userData'), 'server-config.json')
  const servers = store.get('servers', [])
  fs.writeFileSync(configPath, JSON.stringify({ servers }, null, 2))
  return configPath
}

function getStandalonePath(): string {
  // In development: standalone is at build/standalone/server.js relative to repo root
  // In packaged app: standalone is in resources/standalone/server.js
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'standalone', 'server.js')
  }
  return path.join(__dirname, '..', 'build', 'standalone', 'server.js')
}

async function startNextServer(): Promise<number> {
  const port = await getAvailablePort()
  const configPath = writeConfigFile()
  sessionPassword = crypto.randomUUID()

  const serverJs = getStandalonePath()

  if (!fs.existsSync(serverJs)) {
    dialog.showErrorBox(
      'n8n Admin',
      `Next.js 서버 파일을 찾을 수 없습니다.\n경로: ${serverJs}\n\n먼저 빌드를 실행하세요: npm run desktop:build`
    )
    app.quit()
    throw new Error(`server.js not found at ${serverJs}`)
  }

  nextProcess = fork(serverJs, [], {
    env: {
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      ELECTRON_CONFIG_PATH: configPath,
      ADMIN_PASSWORD: sessionPassword,
      NEXTAUTH_SECRET: store.get('nextauthSecret'),
      NEXTAUTH_URL: `http://localhost:${port}`,
    },
    stdio: 'pipe',
  })

  // ELECTRON_RUN_AS_NODE=1 tells the Electron binary (process.execPath) to behave as
  // plain Node.js when spawned as a child. fork() uses process.execPath by default.
  nextProcess.on('error', (err) => {
    console.error('Next.js server error:', err)
  })

  // Consume stdout/stderr to prevent pipe buffer deadlock
  nextProcess.stdout?.on('data', (data) => {
    console.log(`[next] ${data}`)
  })

  nextProcess.stderr?.on('data', (data) => {
    console.error(`[next] ${data}`)
  })

  await waitForServer(port)
  currentPort = port
  return port
}

async function waitForServer(port: number, timeout = 15000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/login`)
      if (res.ok) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Next.js server failed to start within ${timeout}ms`)
}

async function stopNextServer(): Promise<void> {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
    currentPort = null
  }
}

async function restartNextServer(): Promise<void> {
  await stopNextServer()
  const port = await startNextServer()
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://127.0.0.1:${port}`)
  }
}

async function createWindow(port: number): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  const hasServers = (store.get('servers', []) as ServerEntry[]).length > 0
  const url = hasServers
    ? `http://127.0.0.1:${port}`
    : `http://127.0.0.1:${port}/setup`

  mainWindow.loadURL(url)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// IPC handlers
ipcMain.handle('get-servers', () => store.get('servers', []))

ipcMain.handle('save-servers', async (_event, servers: ServerEntry[]) => {
  store.set('servers', servers)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(
      'data:text/html;charset=utf-8,' +
        encodeURIComponent(
          '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#fafafa"><h2>설정 적용 중...</h2></body></html>'
        )
    )
  }
  await restartNextServer()
})

ipcMain.handle('get-session-password', () => sessionPassword)

ipcMain.handle('test-connection', async (_event, url: string, apiKey: string) => {
  try {
    const res = await fetch(`${url}/api/v1/workflows?limit=1`, {
      headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) return { ok: true }
    return { ok: false, error: `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
})

// App lifecycle
app.whenReady().then(async () => {
  try {
    const port = await startNextServer()
    await createWindow(port)
  } catch (err) {
    console.error('Failed to start:', err)
    dialog.showErrorBox('n8n Admin', `앱 시작 실패: ${err}`)
    app.quit()
  }
})

app.on('window-all-closed', async () => {
  await stopNextServer()
  app.quit()
})

app.on('before-quit', () => {
  // Synchronous kill — async handlers are not awaited by Electron
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
})
```

- [ ] **Step 2: Compile and verify**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
npx tsc -p desktop/tsconfig.json
```

Expected: Compiles without errors. `desktop/dist/main.js` is created.

- [ ] **Step 3: Commit**

```bash
git add desktop/main.ts
git commit -m "feat(desktop): add Electron main process with Next.js child management"
```

---

## Task 3: Electron preload script

**Files:**
- Create: `desktop/preload.ts`

- [ ] **Step 1: Write `desktop/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServers: (servers: unknown[]) => ipcRenderer.invoke('save-servers', servers),
  getSessionPassword: () => ipcRenderer.invoke('get-session-password'),
  testConnection: (url: string, apiKey: string) => ipcRenderer.invoke('test-connection', url, apiKey),
  isElectron: true,
})
```

- [ ] **Step 2: Compile and verify**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
npx tsc -p desktop/tsconfig.json
ls desktop/dist/preload.js
```

Expected: Both `main.js` and `preload.js` exist in `desktop/dist/`.

- [ ] **Step 3: Commit**

```bash
git add desktop/preload.ts
git commit -m "feat(desktop): add preload script with IPC bridge"
```

---

## Task 4: Modify Next.js config for standalone output

**Files:**
- Modify: `admin/next.config.ts:1-9`

- [ ] **Step 1: Update `admin/next.config.ts`**

Change the existing file from:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 서버 컴포넌트에서는 process.env로 직접 접근 가능합니다.
  // 클라이언트 컴포넌트에서 env를 사용해야 한다면 아래 env 블록을 활용하세요.
  // (현재는 서버 컴포넌트에서만 env를 읽으므로 별도 노출 불필요)
}

export default nextConfig
```

To:

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
}

export default nextConfig
```

- [ ] **Step 2: Verify Next.js builds with standalone**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
pnpm build
# Verify server.js location — in monorepo setups, path may vary
find .next/standalone -name "server.js" -type f
ls .next/standalone/server.js
```

Expected: Build succeeds and `.next/standalone/server.js` exists. If `server.js` is at a nested path (e.g., `.next/standalone/admin/server.js`), update `getStandalonePath()` in `desktop/main.ts` and the copy step in `scripts/build-desktop.sh` accordingly.

- [ ] **Step 3: Verify standalone server actually starts**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
ADMIN_PASSWORD=test NEXTAUTH_SECRET=test NEXTAUTH_URL=http://localhost:3000 node .next/standalone/server.js &
sleep 3
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/login
kill %1
```

Expected: HTTP 200 from the login page.

- [ ] **Step 4: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/next.config.ts
git commit -m "feat(admin): enable standalone output for Electron bundling"
```

---

## Task 5: Modify server-config.ts for JSON file support

**Files:**
- Modify: `admin/lib/server-config.ts:1-48`

- [ ] **Step 1: Update `admin/lib/server-config.ts`**

Replace the entire file content with:

```typescript
import fs from 'fs'
import { ServerConfig } from './types'

/**
 * .env 또는 JSON 파일에서 서버 목록을 읽어 반환합니다.
 *
 * Electron 환경: ELECTRON_CONFIG_PATH가 설정되면 해당 JSON 파일에서 읽음.
 * 웹 환경: process.env에서 SERVER_URL, SERVER_API_KEY 등을 읽음.
 *
 * ⚠️ 이 함수는 서버 컴포넌트에서만 호출하세요.
 */
export function getServers(): ServerConfig[] {
  // Electron: JSON 파일에서 읽기
  const configPath = process.env.ELECTRON_CONFIG_PATH
  if (configPath) {
    try {
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        return data.servers ?? []
      }
    } catch (err) {
      console.error('Failed to read Electron config:', err)
    }
    return []
  }

  // 웹: .env에서 읽기
  const servers: ServerConfig[] = []

  let i = 1
  while (true) {
    const prefix = i === 1 ? 'SERVER' : `SERVER${i}`
    const url = process.env[`${prefix}_URL`]
    if (!url) break

    servers.push({
      id: `server${i}`,
      name: process.env[`${prefix}_NAME`] ?? `Server ${i}`,
      url,
      apiKey: process.env[`${prefix}_API_KEY`] ?? '',
      description: process.env[`${prefix}_DESCRIPTION`],
    })
    i++
  }

  return servers
}

/**
 * 특정 서버 ID로 서버 설정을 가져옵니다.
 * 없는 경우 에러를 던집니다.
 */
export function getServer(id: string): ServerConfig {
  const servers = getServers()
  const server = servers.find((s) => s.id === id)
  if (!server) throw new Error(`Unknown server: ${id}. Available: ${servers.map((s) => s.id).join(', ')}`)
  return server
}
```

- [ ] **Step 2: Verify the admin app still builds**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
pnpm build
```

Expected: Build succeeds (the `fs` import is fine in server components).

- [ ] **Step 3: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/lib/server-config.ts
git commit -m "feat(admin): support reading server config from JSON file for Electron"
```

---

## Task 6: Update middleware for setup page

**Files:**
- Modify: `admin/middleware.ts:1-5`

- [ ] **Step 1: Update `admin/middleware.ts`**

Replace the entire file:

```typescript
export { auth as middleware } from './auth'

export const config = {
  matcher: ['/((?!login|setup|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

Only change: added `setup|` to the matcher regex.

- [ ] **Step 2: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/middleware.ts
git commit -m "feat(admin): allow unauthenticated access to /setup page"
```

---

## Task 7: Setup page (first-run experience)

**Files:**
- Create: `admin/app/setup/layout.tsx`
- Create: `admin/app/setup/page.tsx`

- [ ] **Step 1: Create `admin/app/setup/layout.tsx`**

Minimal layout without sidebar or auth:

```tsx
export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create `admin/app/setup/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SetupPage() {
  const router = useRouter()
  const [name, setName] = useState('My Server')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Redirect to login if not in Electron
  if (typeof window !== 'undefined' && !window.electronAPI?.isElectron) {
    router.replace('/login')
    return null
  }

  async function handleTest() {
    if (!window.electronAPI) return
    setTesting(true)
    setTestResult(null)
    setError('')
    try {
      // Route through IPC to avoid CORS issues (renderer → main process → n8n)
      const result = await window.electronAPI.testConnection(
        url.replace(/\/+$/, ''),
        apiKey
      )
      setTestResult(result.ok ? 'success' : 'error')
      if (!result.ok) setError(result.error ?? '서버 URL 또는 API 키를 확인하세요.')
    } catch {
      setTestResult('error')
      setError('연결 실패: 서버 URL을 확인하세요.')
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!window.electronAPI) return
    setSaving(true)
    const server = {
      id: 'server1',
      name: name || 'My Server',
      url: url.replace(/\/+$/, ''),
      apiKey,
    }
    await window.electronAPI.saveServers([server])
    // Electron main process restarts Next.js and reloads the window automatically.
    // No further action needed here — the page will be replaced.
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">n8n Admin 설정</CardTitle>
        <CardDescription>n8n 서버를 연결하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">서버 이름</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Server"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">서버 URL</label>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://n8n.example.com"
            type="url"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">API 키</label>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="n8n API 키 입력"
            type="password"
          />
          <p className="text-xs text-muted-foreground">
            n8n → Settings → API → Create API Key에서 발급할 수 있습니다.
          </p>
        </div>

        {testResult === 'success' && (
          <p className="text-sm text-green-600">연결 성공!</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleTest}
            disabled={!url || !apiKey || testing}
          >
            {testing ? '테스트 중...' : '연결 테스트'}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!url || !apiKey || saving}
          >
            {saving ? '저장 중...' : '저장 후 시작'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/app/setup/
git commit -m "feat(admin): add first-run setup page for Electron"
```

---

## Task 8: Settings page (server management inside dashboard)

**Files:**
- Create: `admin/app/(dashboard)/settings/settings-client.tsx`
- Create: `admin/app/(dashboard)/settings/page.tsx`
- Modify: `admin/components/layout/sidebar.tsx:1-62`

- [ ] **Step 1: Create `admin/app/(dashboard)/settings/settings-client.tsx`**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trash2, Plus } from 'lucide-react'
import type { ElectronServer } from '@/lib/electron'

export default function SettingsClient() {
  const [servers, setServers] = useState<ElectronServer[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getServers().then(setServers)
    }
  }, [])

  function addServer() {
    const nextId = `server${servers.length + 1}`
    setServers([...servers, { id: nextId, name: '', url: '', apiKey: '' }])
  }

  function updateServer(index: number, field: keyof ElectronServer, value: string) {
    const updated = [...servers]
    updated[index] = { ...updated[index], [field]: value }
    setServers(updated)
  }

  function removeServer(index: number) {
    setServers(servers.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!window.electronAPI) return
    setSaving(true)
    // Re-assign sequential IDs
    const normalized = servers.map((s, i) => ({
      ...s,
      id: `server${i + 1}`,
      url: s.url.replace(/\/+$/, ''),
    }))
    await window.electronAPI.saveServers(normalized)
    // Electron will restart the app
  }

  if (typeof window === 'undefined' || !window.electronAPI?.isElectron) {
    return (
      <p className="text-muted-foreground text-sm">
        이 설정은 데스크톱 앱에서만 사용할 수 있습니다.
        웹 배포에서는 .env 파일을 직접 편집하세요.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {servers.map((server, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">서버 {i + 1}</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeServer(i)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 size={16} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">이름</label>
              <Input
                value={server.name}
                onChange={(e) => updateServer(i, 'name', e.target.value)}
                placeholder="My Server"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">URL</label>
              <Input
                value={server.url}
                onChange={(e) => updateServer(i, 'url', e.target.value)}
                placeholder="https://n8n.example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">API 키</label>
              <Input
                value={server.apiKey}
                onChange={(e) => updateServer(i, 'apiKey', e.target.value)}
                placeholder="API 키"
                type="password"
              />
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex gap-2">
        <Button variant="outline" onClick={addServer} className="gap-2">
          <Plus size={16} />
          서버 추가
        </Button>
        <Button onClick={handleSave} disabled={saving || servers.length === 0}>
          {saving ? '저장 중...' : '저장 후 적용'}
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `admin/app/(dashboard)/settings/page.tsx`**

```tsx
import SettingsClient from './settings-client'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">서버 설정</h2>
        <p className="text-muted-foreground text-sm mt-1">
          n8n 서버 연결을 관리합니다
        </p>
      </div>
      <SettingsClient />
    </div>
  )
}
```

- [ ] **Step 3: Add Settings nav to sidebar**

Modify `admin/components/layout/sidebar.tsx`. Add `Settings` icon import and a settings nav item that shows only in Electron:

Change the imports line from:
```typescript
import { LayoutDashboard, Workflow, Users, Key, Server, LogOut } from 'lucide-react'
```
to:
```typescript
import { LayoutDashboard, Workflow, Users, Key, Server, Settings, LogOut } from 'lucide-react'
```

Change the `SidebarProps` interface and component to accept `showSettings`:

```typescript
interface SidebarProps {
  showGcp: boolean
  showSettings?: boolean
}

export default function Sidebar({ showGcp, showSettings }: SidebarProps) {
  const pathname = usePathname()
  let nav = showGcp ? [...BASE_NAV, GCP_NAV] : [...BASE_NAV]
  if (showSettings) {
    nav.push({ href: '/settings', label: '설정', icon: Settings })
  }
```

- [ ] **Step 4: Update dashboard empty-state message**

Modify `admin/app/(dashboard)/page.tsx`. Change the empty-state text from:

```tsx
<p className="text-muted-foreground text-sm">
  .env에 SERVER_URL과 SERVER_API_KEY를 입력하면 서버 상태가 표시됩니다.
</p>
```

To:

```tsx
<p className="text-muted-foreground text-sm">
  {process.env.ELECTRON_CONFIG_PATH
    ? '설정에서 서버를 추가하면 상태가 표시됩니다.'
    : '.env에 SERVER_URL과 SERVER_API_KEY를 입력하면 서버 상태가 표시됩니다.'}
</p>
```

- [ ] **Step 5: Pass `showSettings` from dashboard layout**

Modify `admin/app/(dashboard)/layout.tsx`. Change from:

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const showGcp = !!process.env.GCP_PROJECT_ID

  return (
    <div className="flex min-h-screen">
      <Sidebar showGcp={showGcp} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

To:

```tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const showGcp = !!process.env.GCP_PROJECT_ID
  const showSettings = !!process.env.ELECTRON_CONFIG_PATH

  return (
    <div className="flex min-h-screen">
      <Sidebar showGcp={showGcp} showSettings={showSettings} />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Verify build**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/app/\(dashboard\)/settings/ admin/components/layout/sidebar.tsx admin/app/\(dashboard\)/layout.tsx admin/app/\(dashboard\)/page.tsx
git commit -m "feat(admin): add server settings page and nav for Electron"
```

---

## Task 9: Auto-login for Electron

**Files:**
- Modify: `admin/app/(auth)/login/page.tsx:1-54`

- [ ] **Step 1: Add auto-login to the login page**

When Electron loads the app, the user hits the login page. Instead of showing the form, we auto-login using the session password from the preload bridge.

Modify `admin/app/(auth)/login/page.tsx`. Add an `useEffect` for auto-login at the top of the component, after the existing state declarations:

```tsx
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
          <CardDescription>데이터팝콘 서버 관리 대시보드</CardDescription>
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
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin/admin
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add admin/app/\(auth\)/login/page.tsx
git commit -m "feat(admin): add Electron auto-login via IPC session password"
```

---

## Task 10: Build script and electron-builder config

**Files:**
- Create: `electron-builder.yml`
- Create: `scripts/build-desktop.sh`

- [ ] **Step 1: Create `electron-builder.yml`**

```yaml
appId: com.datapopcorn.n8n-admin
productName: n8n Admin
directories:
  output: dist
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: arm64
dmg:
  title: n8n Admin
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
files:
  - desktop/dist/**/*
  - "!desktop/dist/**/*.map"
extraResources:
  - from: build/standalone
    to: standalone
    filter:
      - "**/*"
extraMetadata:
  main: desktop/dist/main.js
```

Note: We use `extraResources` instead of `files` for the standalone bundle. This places it in `Contents/Resources/standalone/` inside the .app, which is where `getStandalonePath()` looks when `app.isPackaged` is true.

- [ ] **Step 2: Create `scripts/build-desktop.sh`**

```bash
#!/bin/bash
# n8n Admin Desktop 빌드 스크립트
# 사용법: ./scripts/build-desktop.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 의존성 확인
command -v pnpm >/dev/null 2>&1 || { echo "오류: pnpm이 필요합니다. npm install -g pnpm 으로 설치하세요."; exit 1; }

echo "=== 1/4: Next.js standalone 빌드 ==="
cd admin
pnpm install --frozen-lockfile
pnpm build
cd "$REPO_ROOT"

echo "=== 2/4: standalone 출력물 복사 ==="
rm -rf build/standalone
mkdir -p build/standalone
cp -r admin/.next/standalone/* build/standalone/
cp -r admin/.next/static build/standalone/.next/static
cp -r admin/public build/standalone/public

echo "=== 3/4: Electron 코드 컴파일 ==="
npx tsc -p desktop/tsconfig.json

echo "=== 4/4: Electron 앱 빌드 (DMG) ==="
npx electron-builder --mac

echo ""
echo "빌드 완료! DMG 파일:"
ls -la dist/*.dmg
```

- [ ] **Step 3: Make build script executable**

```bash
chmod +x /Users/popcorn/Documents/Github/n8n-admin/scripts/build-desktop.sh
```

- [ ] **Step 4: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add electron-builder.yml scripts/build-desktop.sh
git commit -m "feat(desktop): add electron-builder config and build script"
```

---

## Task 11: End-to-end test — build and run

This task validates the full pipeline works. No new code — just building and running.

- [ ] **Step 1: Run the full build**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
./scripts/build-desktop.sh
```

Expected: DMG file created in `dist/` directory.

- [ ] **Step 2: Open the DMG and run the app**

```bash
# Mount the DMG
open dist/*.dmg
```

Manually:
1. Drag "n8n Admin" to Applications
2. Open the app
3. If macOS blocks it: System Settings → Privacy & Security → "Open Anyway"
4. Verify the setup page appears
5. Enter a test server URL and API key
6. Click "연결 테스트" → verify it succeeds
7. Click "저장 후 시작" → verify the dashboard loads

- [ ] **Step 3: Verify server management**

In the running app:
1. Click "설정" in the sidebar
2. Add a second server
3. Click "저장 후 적용"
4. Verify the app restarts and shows both servers on the dashboard

- [ ] **Step 4: Update `.gitignore` if needed and commit any fixes**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add -A
git status
# Only commit if there are meaningful fixes
```

---

## Task 12: Update README with desktop app section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add Desktop App section to README**

Add this section after the "Admin 대시보드 배포 (선택)" section (after line 71):

```markdown
---

## Desktop App (macOS)

개발 도구 설치 없이 n8n 서버를 관리하고 싶다면 데스크톱 앱을 사용하세요.

### 설치

1. [최신 릴리즈](https://github.com/datapopcorn/n8n-admin/releases)에서 `n8n-Admin.dmg` 다운로드
2. DMG를 열고 `n8n Admin`을 Applications 폴더로 드래그
3. 앱 실행 → 서버 URL과 API 키 입력 → 끝!

> macOS에서 "확인되지 않은 개발자" 경고가 나타나면:
> 시스템 설정 → 개인정보 보호 및 보안 → "그래도 열기" 클릭

### 직접 빌드

```bash
# 의존성 설치
npm install
cd admin && pnpm install && cd ..

# DMG 빌드
./scripts/build-desktop.sh
# dist/ 폴더에 DMG 파일이 생성됩니다
```
```

- [ ] **Step 2: Commit**

```bash
cd /Users/popcorn/Documents/Github/n8n-admin
git add README.md
git commit -m "docs: add Desktop App section to README"
```
