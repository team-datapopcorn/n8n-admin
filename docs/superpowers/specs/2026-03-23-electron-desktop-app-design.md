# n8n Admin Desktop App — Electron 설계 문서

## 목표

비개발자가 DMG를 설치하고, 앱을 열어 n8n 서버 URL과 API 키만 입력하면 바로 서버를 관리할 수 있게 한다. 터미널, Node.js, pnpm 등 개발 도구가 전혀 필요 없다.

## 기술 스택

- **Electron** — 데스크톱 앱 프레임워크
- **Next.js** (기존 admin 앱) — standalone 모드로 빌드, Electron 내장
- **electron-store** — 서버 설정(URL, API 키) 및 앱 시크릿 로컬 저장
- **electron-builder** — macOS DMG 빌드

## 아키텍처

```
n8n-admin/
├── admin/                   # 기존 Next.js 앱 (수정 최소화)
│   ├── lib/server-config.ts # JSON 파일 → 환경변수 분기
│   └── ...
├── desktop/                 # 신규: Electron 관련 코드
│   ├── main.ts              # Electron 메인 프로세스
│   ├── preload.ts           # IPC 브리지 (렌더러 ↔ 메인)
│   └── tsconfig.json
├── electron-builder.yml     # DMG 빌드 설정
├── package.json             # 루트: Electron 의존성 + 빌드 스크립트
└── ...
```

### 동작 흐름

```
앱 실행
  → Electron main process 시작
  → electron-store에서 서버 설정을 JSON 파일로 기록
  → Next.js standalone 서버를 child_process.fork()로 실행 (ELECTRON_RUN_AS_NODE=1, 랜덤 포트)
  → waitForServer()로 서버 준비 대기 (최대 10초, 500ms 간격 폴링)
  → BrowserWindow에서 localhost:{port} 로드
  → 서버 설정이 없으면 → /setup 화면 표시 (대시보드 밖 라우트)
  → 서버 설정이 있으면 → 자동 로그인 → 대시보드 진입
```

## 유저 플로우

### 첫 실행

1. `n8n Admin.dmg` 다운로드 → Applications로 드래그
2. 앱 실행 (macOS 보안 경고 시 "열기" 클릭)
3. **서버 연결 화면** (`/setup`) 표시:
   - 서버 이름 (선택, 기본값 "My Server")
   - 서버 URL 입력 (예: `https://n8n.example.com`)
   - API 키 입력
   - "API 키 발급 방법" 도움말 (인라인 안내: n8n → Settings → API → Create API Key)
   - "연결 테스트" 버튼 → health check 후 성공/실패 표시
   - "저장" 버튼
4. 연결 성공 → 자동 로그인 → 대시보드 진입

### 재실행

1. 앱 실행 → 저장된 서버 설정 자동 로드 → 자동 로그인 → 바로 대시보드 진입

### 서버 추가/수정

- 대시보드 사이드바 하단 "설정" 메뉴 → 서버 관리 화면
- 서버 추가/수정/삭제 가능
- 저장 시 JSON 파일 갱신 → Next.js 프로세스 재시작 (로딩 화면 표시)

## 기존 코드 수정 사항

### 1. `lib/server-config.ts` — 서버 설정 소스 분기

현재: `process.env`에서 `SERVER_URL`, `SERVER_API_KEY` 등을 읽음.

변경: Electron 환경에서는 JSON 파일에서 읽도록 분기.

```typescript
import fs from 'fs'

export function getServers(): ServerConfig[] {
  // Electron 환경: JSON 파일에서 읽기
  const configPath = process.env.ELECTRON_CONFIG_PATH
  if (configPath && fs.existsSync(configPath)) {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
    return data.servers ?? []
  }
  // 기존 로직: .env에서 읽기
  // ... (현재 코드 그대로)
}
```

**Electron 메인 프로세스**가 `electron-store`에서 서버 목록을 읽어 JSON 파일로 기록하고, 그 파일 경로를 `ELECTRON_CONFIG_PATH` 환경변수로 Next.js 프로세스에 전달한다.

JSON 파일 방식의 장점:
- 환경변수 크기 제한 문제 없음
- 설정 변경 시 파일만 갱신하면 됨 (향후 핫 리로드 가능성)
- Next.js 코드 변경이 `server-config.ts` 한 파일로 제한

### 2. `auth.ts` — Electron 모드 인증

현재: `ADMIN_PASSWORD` 환경변수로 비밀번호 인증.

변경: Electron 환경에서는 랜덤 생성된 세션 비밀번호로 인증.

```typescript
authorize(credentials) {
  // Electron: 매 실행마다 랜덤 생성된 비밀번호로 인증
  // (Electron 메인 프로세스가 ADMIN_PASSWORD에 랜덤 값을 설정)
  if (credentials.password === process.env.ADMIN_PASSWORD) {
    return { id: '1', name: 'Admin', email: 'admin@example.com' }
  }
  return null
},
```

기존 authorize 로직을 변경하지 않는다. 대신 Electron 메인 프로세스가:
1. 앱 시작 시 `crypto.randomUUID()`로 세션 비밀번호 생성
2. `ADMIN_PASSWORD` 환경변수에 해당 값 설정하여 Next.js에 전달
3. BrowserWindow 로드 후 IPC를 통해 자동 로그인 (preload에서 비밀번호 전달)

이렇게 하면:
- auth.ts 코드 변경 없음
- localhost에 접근해도 비밀번호 없이는 로그인 불가
- 매 실행마다 비밀번호가 바뀌므로 예측 불가

### 3. `middleware.ts` — setup 페이지 예외 추가

```typescript
export const config = {
  matcher: ['/((?!login|setup|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

`/setup` 경로를 인증 예외에 추가.

### 4. `next.config.ts` — standalone 출력

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
}
```

### 5. 설정 화면 추가

- **초기 설정 페이지**: `app/setup/page.tsx` (대시보드 레이아웃 밖, 인증 불필요)
  - 서버 URL + API 키 입력 폼
  - 연결 테스트 버튼
  - API 키 발급 방법 인라인 안내
- **서버 관리 페이지**: `app/(dashboard)/settings/page.tsx` (대시보드 안, 인증 필요)
  - 서버 추가/수정/삭제
  - Electron IPC를 통해 electron-store에 저장
  - 저장 후 Next.js 프로세스 재시작

### 6. GCP 기능 비활성화

Electron 모드에서는 `GCP_PROJECT_ID`를 설정하지 않으므로, 기존 코드(`dashboard/layout.tsx`의 `showGcp` 로직)에 의해 자동으로 GCP 탭이 숨겨진다. 추가 코드 변경 불필요.

## Electron 코드 상세

### `desktop/main.ts`

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import Store from 'electron-store'
import { fork, ChildProcess } from 'child_process'
import getPort from 'get-port'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const store = new Store({
  schema: {
    servers: {
      type: 'array',
      default: [],
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          url: { type: 'string' },
          apiKey: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    nextauthSecret: {
      type: 'string',
      default: '',
    },
  },
})

// 첫 실행 시 NEXTAUTH_SECRET 영구 생성
if (!store.get('nextauthSecret')) {
  store.set('nextauthSecret', crypto.randomBytes(32).toString('base64'))
}

let nextProcess: ChildProcess | null = null
let currentPort: number | null = null
let sessionPassword: string = ''
let mainWindow: BrowserWindow | null = null

// 서버 설정을 JSON 파일로 기록
function writeConfigFile(): string {
  const configPath = path.join(app.getPath('userData'), 'server-config.json')
  const servers = store.get('servers', [])
  fs.writeFileSync(configPath, JSON.stringify({ servers }, null, 2))
  return configPath
}

async function startNextServer(): Promise<number> {
  const port = await getPort()
  const configPath = writeConfigFile()
  sessionPassword = crypto.randomUUID()

  const serverJs = path.join(__dirname, 'standalone', 'server.js')

  nextProcess = fork(serverJs, [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      ELECTRON_CONFIG_PATH: configPath,
      ADMIN_PASSWORD: sessionPassword,
      NEXTAUTH_SECRET: store.get('nextauthSecret') as string,
      NEXTAUTH_URL: `http://localhost:${port}`,
    },
  })

  nextProcess.on('error', (err) => {
    console.error('Next.js server error:', err)
  })

  await waitForServer(port)
  currentPort = port
  return port
}

async function waitForServer(port: number, timeout = 10000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/auth/csrf`)
      if (res.ok) return
    } catch {
      // 아직 준비 안 됨
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Next.js server failed to start within ${timeout}ms`)
}

async function restartNextServer(): Promise<void> {
  if (nextProcess) {
    nextProcess.kill()
    nextProcess = null
  }
  const port = await startNextServer()
  if (mainWindow) {
    mainWindow.loadURL(`http://127.0.0.1:${port}`)
  }
}

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  const hasServers = (store.get('servers', []) as any[]).length > 0
  if (hasServers) {
    mainWindow.loadURL(`http://127.0.0.1:${port}`)
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}/setup`)
  }
}

// IPC 핸들러
ipcMain.handle('get-servers', () => store.get('servers', []))
ipcMain.handle('save-servers', async (_event, servers) => {
  store.set('servers', servers)
  // 로딩 화면 표시 후 재시작
  if (mainWindow) {
    mainWindow.loadURL('data:text/html,<h2 style="font-family:sans-serif;text-align:center;margin-top:40vh">설정 적용 중...</h2>')
  }
  await restartNextServer()
})
ipcMain.handle('get-session-password', () => sessionPassword)

app.whenReady().then(async () => {
  const port = await startNextServer()
  await createWindow(port)
})

app.on('window-all-closed', () => {
  if (nextProcess) nextProcess.kill()
  app.quit()
})
```

### `desktop/preload.ts`

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('get-servers'),
  saveServers: (servers: any[]) => ipcRenderer.invoke('save-servers', servers),
  getSessionPassword: () => ipcRenderer.invoke('get-session-password'),
  isElectron: true,
})
```

### 자동 로그인 흐름

setup 페이지 또는 앱 재시작 후, 클라이언트에서 자동 로그인:

```typescript
// setup 페이지 또는 대시보드 진입 시
if (window.electronAPI?.isElectron) {
  const password = await window.electronAPI.getSessionPassword()
  await signIn('credentials', { password, redirect: false })
}
```

## 빌드 & 배포

### 빌드 프로세스

```bash
# 1. Next.js standalone 빌드
cd admin && pnpm build

# 2. standalone 출력물을 빌드 디렉토리에 복사
mkdir -p build/standalone
cp -r .next/standalone/* build/standalone/
cp -r .next/static build/standalone/.next/static
cp -r public build/standalone/public

# 3. Electron 코드 컴파일
cd ../desktop && npx tsc

# 4. Electron 빌드 → DMG 생성
cd .. && npx electron-builder --mac
```

### `electron-builder.yml`

```yaml
appId: com.datapopcorn.n8n-admin
productName: n8n Admin
directories:
  output: dist
  buildResources: build
mac:
  category: public.app-category.developer-tools
  target: dmg
  icon: build/icon.icns
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
  - build/standalone/**/*
extraMetadata:
  main: desktop/dist/main.js
```

### 앱 크기 예상

| 구성요소 | 크기 |
|----------|------|
| Electron (arm64) | ~150MB |
| Next.js standalone | ~20MB |
| node_modules (런타임) | ~10MB |
| **총합 (DMG 압축 후)** | **~120-150MB** |

> arm64 단일 아키텍처로 빌드하여 크기 최소화. Universal Binary(arm64+x64)는 ~300MB.

### 배포

- GitHub Releases에 DMG 파일 업로드
- README에 다운로드 링크 추가
- 코드 서명 없으므로 macOS "확인되지 않은 개발자" 우회 안내 필요

## 코드 서명 미적용 시 유저 안내

README에 추가할 내용:

> macOS에서 처음 앱을 열 때 "확인되지 않은 개발자" 경고가 나타나면:
> 1. 시스템 설정 → 개인정보 보호 및 보안
> 2. "n8n Admin" 앞에 있는 "그래도 열기" 클릭

## 리뷰 반영 사항

| 이슈 | 해결 |
|------|------|
| `process.execPath`가 Electron 바이너리를 가리킴 | `fork()` + `ELECTRON_RUN_AS_NODE=1` 사용 |
| 인증 우회로 API 키 노출 위험 | 세션별 랜덤 비밀번호 + 자동 로그인 방식으로 변경 |
| Next.js 재시작 흐름 미정의 | `restartNextServer()` 구현, 로딩 화면 포함 |
| 환경변수로 서버 설정 전달 시 크기 제한 | JSON 파일 방식으로 변경 |
| `waitForServer` 미정의 | 500ms 간격 폴링, 10초 타임아웃 구현 |
| 설정 페이지가 대시보드 레이아웃 안에 있음 | `/setup`은 레이아웃 밖, `/settings`는 안에 분리 |
| `description` 필드 누락 | store 스키마에 추가 |
| 미들웨어가 setup 페이지 차단 | matcher에 `setup` 예외 추가 |
| `NEXTAUTH_SECRET` 하드코딩 | 첫 실행 시 랜덤 생성, electron-store에 영구 저장 |
| GCP 기능 처리 | 기존 `showGcp` 로직이 자동으로 숨김, 변경 불필요 |

## 범위 외 (향후)

- Windows/Linux 빌드 (Electron은 지원하지만 이번에는 macOS만)
- 자동 업데이트 (electron-updater)
- macOS 코드 서명 및 공증 (Apple Developer 계정 필요)
- 쉘 스크립트 기능의 GUI 통합 (현재는 대시보드 기능만)
- 서버 설정 핫 리로드 (재시작 없이 JSON 파일 변경 감지)
- 연결 끊김 시 UX (현재 healthCheck로 대시보드에 표시는 됨)
