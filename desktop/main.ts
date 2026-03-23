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
