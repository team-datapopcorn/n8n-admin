# n8n-admin 강의용 제품화 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인프런 강의 수강생이 n8n-admin을 5분 내에 시작하고 바로 사용할 수 있도록 제품화한다.

**Architecture:** 4 Phase로 나누어 구현한다. Phase 1은 온보딩(위자드/데모/셋업), Phase 2는 스킬 초보자 모드, Phase 3는 관리 기능(에러 트리거/퇴사자 인계), Phase 4는 Windows 빌드 + CI/CD. 기존 패턴(React Query, n8n-client.ts, _common.sh)을 그대로 따른다.

**Tech Stack:** Next.js 16, React 19, TypeScript, Electron 41, electron-builder, TailwindCSS 4, React Query, NextAuth 5, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-26-lecture-ready-n8n-admin-design.md`

---

## 파일 구조 맵

### Phase 1: 첫 실행 경험
```
admin/
  app/setup/
    page.tsx                          # 수정: 스텝 위자드로 리팩토링
  app/(dashboard)/settings/
    page.tsx                          # 수정: Claude Code 연결 섹션 추가
  components/
    setup-wizard.tsx                  # 생성: 스텝 위자드 컴포넌트
    demo-banner.tsx                   # 생성: 데모 모드 배너
  lib/
    demo-data.ts                     # 생성: mock 데이터
    demo-context.tsx                 # 생성: 데모 모드 상태 관리 (React Context)
setup.sh                             # 생성: macOS/Linux 셋업 스크립트
setup.ps1                            # 생성: Windows PowerShell 셋업 스크립트
```

### Phase 2: 스킬 초보자 모드
```
.claude/skills/n8n/
  SKILL.md                           # 수정: 초보자 안내 + 에러 가이드 추가
  references/
    ops-manager.md                   # 수정: 표 형식 포맷 가이드 추가
    workflow-builder.md              # 수정: 미리보기 단계 추가
    teaching-guide.md                # 수정: 스킬 수정 가이드 섹션 추가
```

### Phase 3: 관리 기능
```
scripts/
  add-error-triggers.sh              # 생성: 에러 트리거 일괄 등록
  transfer-ownership.sh              # 생성: 퇴사자 인계
admin/
  lib/
    n8n-client.ts                    # 수정: transferOwnership, getWorkflowsByUser 추가
  app/api/servers/[server]/
    workflows/batch-error-triggers/
      route.ts                       # 생성: 에러 트리거 일괄 등록 API
    users/[id]/transfer/
      route.ts                       # 생성: 소유권 이전 API
  app/(dashboard)/
    workflows/workflows-client.tsx   # 수정: 에러 트리거 컬럼 + 일괄 등록 버튼
    users/users-client.tsx           # 수정: 인계 버튼 + 유저 자산 조회
.claude/skills/n8n/references/
  ops-manager.md                     # 수정: 에러 트리거 + 퇴사자 인계 섹션
```

### Phase 4: 배포
```
build/
  icon.ico                           # 생성: Windows 아이콘
electron-builder.yml                 # 수정: win 섹션 추가
scripts/
  build-desktop.sh                   # 수정: --platform 옵션 추가
.github/workflows/
  build-desktop.yml                  # 생성: 크로스 플랫폼 빌드 CI/CD
```

---

## Phase 1: 첫 실행 경험

### Task 1: 데모 모드 데이터 및 Context 생성

**Files:**
- Create: `admin/lib/demo-data.ts`
- Create: `admin/lib/demo-context.tsx`

- [ ] **Step 1: `admin/lib/demo-data.ts` 작성**

```typescript
import type { N8nWorkflow, N8nUser, N8nCredential } from './types'

export const DEMO_WORKFLOWS: N8nWorkflow[] = [
  {
    id: 'demo-1',
    name: '[CRON] 매일 아침 AI 브리핑',
    active: true,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-25T09:00:00.000Z',
    tags: [{ id: 't1', name: '정기실행' }],
    nodes: [
      { type: 'n8n-nodes-base.scheduleTrigger' },
      { type: 'n8n-nodes-base.httpRequest' },
      { type: '@n8n/n8n-nodes-langchain.openAi' },
      { type: 'n8n-nodes-base.slack' },
    ],
  },
  {
    id: 'demo-2',
    name: '[WEBHOOK] 고객 문의 자동 분류',
    active: true,
    createdAt: '2026-02-15T00:00:00.000Z',
    updatedAt: '2026-03-24T14:00:00.000Z',
    tags: [{ id: 't2', name: '웹훅' }],
    nodes: [
      { type: 'n8n-nodes-base.webhook' },
      { type: '@n8n/n8n-nodes-langchain.openAi' },
      { type: 'n8n-nodes-base.googleSheets' },
    ],
  },
  {
    id: 'demo-3',
    name: '[TRIGGER] 에러 알림 → Slack',
    active: true,
    createdAt: '2026-03-10T00:00:00.000Z',
    updatedAt: '2026-03-20T11:00:00.000Z',
    tags: [{ id: 't3', name: '모니터링' }],
    nodes: [
      { type: 'n8n-nodes-base.errorTrigger' },
      { type: 'n8n-nodes-base.slack' },
    ],
  },
  {
    id: 'demo-4',
    name: 'Copy of My Workflow (1)',
    active: false,
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
    tags: [],
    nodes: [{ type: 'n8n-nodes-base.manualTrigger' }],
  },
  {
    id: 'demo-5',
    name: 'test',
    active: false,
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
    tags: [],
    nodes: [{ type: 'n8n-nodes-base.manualTrigger' }],
  },
]

export const DEMO_USERS: N8nUser[] = [
  {
    id: 'demo-u1',
    email: 'admin@example.com',
    firstName: '관리자',
    lastName: '',
    role: 'global:owner',
    isPending: false,
    createdAt: '2025-12-01T00:00:00.000Z',
    updatedAt: '2026-03-26T00:00:00.000Z',
    lastActiveAt: '2026-03-26T00:00:00.000Z',
    daysSinceActive: 0,
  },
  {
    id: 'demo-u2',
    email: 'member@example.com',
    firstName: '김팀원',
    lastName: '',
    role: 'global:member',
    isPending: false,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    lastActiveAt: '2026-03-20T00:00:00.000Z',
    daysSinceActive: 6,
  },
  {
    id: 'demo-u3',
    email: 'dormant@example.com',
    firstName: '이퇴사',
    lastName: '',
    role: 'global:member',
    isPending: false,
    createdAt: '2025-06-01T00:00:00.000Z',
    updatedAt: '2025-10-01T00:00:00.000Z',
    lastActiveAt: '2025-10-01T00:00:00.000Z',
    daysSinceActive: 177,
  },
]

export const DEMO_CREDENTIALS: N8nCredential[] = [
  { id: 'demo-c1', name: 'OpenAI API', type: 'openAiApi', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' },
  { id: 'demo-c2', name: 'Slack Bot Token', type: 'slackApi', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-15T00:00:00.000Z' },
  { id: 'demo-c3', name: 'Google Sheets', type: 'googleSheetsOAuth2Api', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-03-10T00:00:00.000Z' },
  { id: 'demo-c4', name: 'test credential', type: 'httpBasicAuth', createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z' },
]

export const DEMO_SERVER = {
  id: 'demo' as const,
  name: 'Demo Server',
  url: 'https://demo.n8n.example.com',
  apiKey: 'demo-api-key',
  description: '데모 모드 — 실제 서버가 아닙니다',
}
```

- [ ] **Step 2: `admin/lib/demo-context.tsx` 작성**

```typescript
'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

interface DemoContextValue {
  isDemoMode: boolean
  enableDemoMode: () => void
  disableDemoMode: () => void
}

const DemoContext = createContext<DemoContextValue>({
  isDemoMode: false,
  enableDemoMode: () => {},
  disableDemoMode: () => {},
})

export function DemoProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        enableDemoMode: () => setIsDemoMode(true),
        disableDemoMode: () => setIsDemoMode(false),
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoMode() {
  return useContext(DemoContext)
}
```

- [ ] **Step 3: 커밋**

```bash
git add admin/lib/demo-data.ts admin/lib/demo-context.tsx
git commit -m "feat: add demo mode data and context provider"
```

---

### Task 2: 데모 모드 배너 컴포넌트

**Files:**
- Create: `admin/components/demo-banner.tsx`

- [ ] **Step 1: `admin/components/demo-banner.tsx` 작성**

```typescript
'use client'

import { useDemoMode } from '@/lib/demo-context'

export function DemoBanner() {
  const { isDemoMode } = useDemoMode()
  if (!isDemoMode) return null

  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
      <span className="font-medium">데모 모드</span> — 실제 n8n 서버를 연결하면 이 배너가 사라집니다.
    </div>
  )
}
```

- [ ] **Step 2: `admin/app/(dashboard)/layout.tsx`에 DemoProvider와 DemoBanner 추가**

기존 layout에 import 추가하고 children을 DemoProvider로 감싸고, main content 영역 최상단에 DemoBanner 추가.

```typescript
import { DemoProvider } from '@/lib/demo-context'
import { DemoBanner } from '@/components/demo-banner'
```

layout의 return JSX에서:
```tsx
<DemoProvider>
  <DemoBanner />
  {/* 기존 children */}
</DemoProvider>
```

- [ ] **Step 3: 커밋**

```bash
git add admin/components/demo-banner.tsx admin/app/\(dashboard\)/layout.tsx
git commit -m "feat: add demo mode banner to dashboard layout"
```

---

### Task 3: 설정 위자드 컴포넌트

**Files:**
- Create: `admin/components/setup-wizard.tsx`
- Modify: `admin/app/setup/page.tsx`

- [ ] **Step 1: `admin/components/setup-wizard.tsx` 작성**

4-step 위자드 컴포넌트. 각 스텝:
1. **환영**: 서버 연결 버튼 + 데모 모드 버튼
2. **URL 입력**: n8n URL 텍스트 입력 + 실시간 연결 테스트 (health_check)
3. **API 키 입력**: API 키 텍스트 입력 + 유효성 검증 (워크플로우 목록 조회)
4. **완료**: 서버 요약 + 대시보드 이동 버튼

```typescript
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDemoMode } from '@/lib/demo-context'

type Step = 'welcome' | 'url' | 'apikey' | 'done'

interface SetupWizardProps {
  onComplete: (server: { name: string; url: string; apiKey: string }) => void
  onDemoMode: () => void
}

export function SetupWizard({ onComplete, onDemoMode }: SetupWizardProps) {
  const [step, setStep] = useState<Step>('welcome')
  const [url, setUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [serverName, setServerName] = useState('My n8n Server')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [workflowCount, setWorkflowCount] = useState(0)

  async function testUrl() {
    setTesting(true)
    setTestResult(null)
    try {
      const cleanUrl = url.replace(/\/+$/, '')
      const res = await fetch(`${cleanUrl}/api/v1/workflows?limit=1`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        setTestResult({ ok: true, message: '연결 성공!' })
        setUrl(cleanUrl)
      } else {
        setTestResult({ ok: false, message: `연결 실패 (HTTP ${res.status}). URL을 확인해주세요.` })
      }
    } catch {
      setTestResult({ ok: false, message: 'URL에 연결할 수 없습니다. 주소를 확인해주세요. 예: https://your-n8n.com' })
    }
    setTesting(false)
  }

  async function testApiKey() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch(`${url}/api/v1/workflows?limit=1`, {
        headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const json = await res.json()
        const count = json.data?.length ?? 0
        setWorkflowCount(json.nextCursor ? 100 : count) // 대략적 카운트
        setTestResult({ ok: true, message: `인증 성공! 워크플로우를 발견했습니다.` })
      } else if (res.status === 401) {
        setTestResult({ ok: false, message: 'API 키가 올바르지 않습니다. n8n → Settings → API에서 키를 확인해주세요.' })
      } else {
        setTestResult({ ok: false, message: `인증 실패 (HTTP ${res.status}).` })
      }
    } catch {
      setTestResult({ ok: false, message: '연결할 수 없습니다.' })
    }
    setTesting(false)
  }

  if (step === 'welcome') {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="text-2xl font-bold">n8n Admin에 오신 것을 환영합니다!</h1>
        <p className="text-muted-foreground max-w-md">
          n8n 서버를 연결하면 워크플로우, 유저, 크레덴셜을 한 곳에서 관리할 수 있습니다.
        </p>
        <div className="flex gap-3">
          <Button size="lg" onClick={() => setStep('url')}>
            서버 연결하기
          </Button>
          <Button size="lg" variant="outline" onClick={onDemoMode}>
            서버 없이 둘러보기
          </Button>
        </div>
      </div>
    )
  }

  if (step === 'url') {
    return (
      <div className="flex flex-col gap-4 max-w-md w-full">
        <h2 className="text-xl font-bold">Step 1/3 — n8n 서버 주소</h2>
        <p className="text-sm text-muted-foreground">n8n 서버의 URL을 입력해주세요.</p>
        <Input
          placeholder="https://your-n8n.com"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setTestResult(null) }}
        />
        {testResult && (
          <p className={testResult.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
            {testResult.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setStep('welcome')}>이전</Button>
          {testResult?.ok ? (
            <Button onClick={() => { setTestResult(null); setStep('apikey') }}>다음</Button>
          ) : (
            <Button onClick={testUrl} disabled={!url || testing}>
              {testing ? '확인 중...' : '연결 테스트'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'apikey') {
    return (
      <div className="flex flex-col gap-4 max-w-md w-full">
        <h2 className="text-xl font-bold">Step 2/3 — API 키</h2>
        <p className="text-sm text-muted-foreground">
          n8n → Settings → API에서 API 키를 복사해주세요.
        </p>
        <Input
          type="password"
          placeholder="n8n API 키"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); setTestResult(null) }}
        />
        {testResult && (
          <p className={testResult.ok ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
            {testResult.message}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setTestResult(null); setStep('url') }}>이전</Button>
          {testResult?.ok ? (
            <Button onClick={() => { setTestResult(null); setStep('done') }}>다음</Button>
          ) : (
            <Button onClick={testApiKey} disabled={!apiKey || testing}>
              {testing ? '확인 중...' : '키 검증'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // step === 'done'
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="text-xl font-bold">설정이 완료되었습니다!</h2>
      <div className="bg-muted rounded-lg p-4 text-sm text-left w-full max-w-md">
        <p><span className="font-medium">서버:</span> {url}</p>
        <p><span className="font-medium">상태:</span> 연결됨</p>
      </div>
      <Input
        placeholder="서버 이름 (선택)"
        value={serverName}
        onChange={(e) => setServerName(e.target.value)}
        className="max-w-md"
      />
      <Button size="lg" onClick={() => onComplete({ name: serverName, url, apiKey })}>
        대시보드로 이동
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: `admin/app/setup/page.tsx` 리팩토링**

기존 setup 페이지를 SetupWizard 컴포넌트를 사용하도록 변경. 기존의 서버 입력 폼을 SetupWizard로 교체하되, Electron IPC 호출(`saveServers`, 데모 모드 라우팅)은 이 페이지에서 처리.

핵심 변경:
- `onComplete` 핸들러: Electron이면 `window.electronAPI.saveServers()`, 웹이면 안내 메시지 표시
- `onDemoMode` 핸들러: `enableDemoMode()` 호출 + `router.push('/')` 대시보드로 이동
- 기존 코드 중 서버 입력 폼 부분을 `<SetupWizard>` 컴포넌트로 교체

- [ ] **Step 3: 커밋**

```bash
git add admin/components/setup-wizard.tsx admin/app/setup/page.tsx
git commit -m "feat: replace setup page with guided wizard"
```

---

### Task 4: 대시보드 페이지에 데모 모드 분기 적용

**Files:**
- Modify: `admin/app/(dashboard)/workflows/workflows-client.tsx`
- Modify: `admin/app/(dashboard)/users/users-client.tsx`

- [ ] **Step 1: workflows-client.tsx에 데모 모드 분기 추가**

React Query의 `queryFn`에서 데모 모드 분기:

```typescript
import { useDemoMode } from '@/lib/demo-context'
import { DEMO_WORKFLOWS } from '@/lib/demo-data'

// 컴포넌트 내부:
const { isDemoMode } = useDemoMode()

const { data: workflows = [], isLoading } = useQuery<N8nWorkflow[]>({
  queryKey: ['workflows-all', isDemoMode ? 'demo' : server],
  queryFn: async () => {
    if (isDemoMode) return DEMO_WORKFLOWS
    // 기존 fetch 로직 유지
    const all: N8nWorkflow[] = []
    let cursor: string | undefined = undefined
    do {
      const params = cursor ? `?limit=100&cursor=${cursor}` : '?limit=100'
      const res = await fetch(`/api/servers/${server}/workflows${params}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      all.push(...json.data)
      cursor = json.nextCursor ?? undefined
    } while (cursor)
    return all
  },
  staleTime: 5 * 60 * 1000,
})
```

데모 모드일 때 삭제/수정 버튼 비활성화:

```tsx
<Button
  variant="destructive"
  disabled={isDemoMode}
  title={isDemoMode ? '데모 모드에서는 사용할 수 없습니다' : undefined}
  onClick={() => deleteMutation.mutate(workflow.id)}
>
  삭제
</Button>
```

- [ ] **Step 2: users-client.tsx에 동일 패턴 적용**

동일하게 `useDemoMode()` + `DEMO_USERS` import, queryFn 분기, 쓰기 버튼 비활성화.

- [ ] **Step 3: credentials 페이지에도 동일 패턴 적용**

`admin/app/(dashboard)/credentials/` 페이지에 `DEMO_CREDENTIALS` 분기 추가.

- [ ] **Step 4: 대시보드 메인 페이지에 데모 모드 분기 적용**

`admin/app/(dashboard)/page.tsx`에서 서버 health check를 데모 모드일 때 mock 데이터로 반환.

- [ ] **Step 5: 커밋**

```bash
git add admin/app/\(dashboard\)/workflows/workflows-client.tsx \
       admin/app/\(dashboard\)/users/users-client.tsx \
       admin/app/\(dashboard\)/credentials/ \
       admin/app/\(dashboard\)/page.tsx
git commit -m "feat: integrate demo mode across all dashboard pages"
```

---

### Task 5: 원클릭 셋업 스크립트 (macOS/Linux)

**Files:**
- Create: `setup.sh`

- [ ] **Step 1: `setup.sh` 작성**

```bash
#!/bin/bash
# n8n Admin 셋업 스크립트
# 사용법: ./setup.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"
ENV_FILE="$REPO_ROOT/.env"

echo "=== n8n Admin 셋업 ==="
echo ""

# 1. 필수 도구 확인
echo "--- 필수 도구 확인 ---"
MISSING=()
if ! command -v node &>/dev/null; then
  MISSING+=("Node.js (https://nodejs.org)")
fi
if ! command -v pnpm &>/dev/null; then
  MISSING+=("pnpm (npm install -g pnpm)")
fi
if ! command -v jq &>/dev/null; then
  MISSING+=("jq (brew install jq)")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "다음 도구가 필요합니다:"
  for tool in "${MISSING[@]}"; do
    echo "  - $tool"
  done
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "Node.js 18 이상이 필요합니다. 현재: $(node -v)"
  exit 1
fi
echo "Node.js $(node -v), pnpm $(pnpm -v), jq $(jq --version) 확인 완료"

# 2. 의존성 설치
echo ""
echo "--- 의존성 설치 ---"
cd admin && pnpm install && cd "$REPO_ROOT"
npm install
echo "의존성 설치 완료"

# 3. .env 파일 생성
echo ""
echo "--- 서버 설정 ---"
if [ -f "$ENV_FILE" ]; then
  read -p ".env 파일이 이미 있습니다. 덮어쓸까요? (y/N): " OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    echo ".env 파일을 유지합니다."
    SKIP_ENV=true
  fi
fi

if [ "${SKIP_ENV:-}" != "true" ]; then
  echo "n8n 서버 정보를 입력해주세요."
  echo ""

  read -p "서버 이름 (기본: My n8n Server): " SERVER_NAME
  SERVER_NAME="${SERVER_NAME:-My n8n Server}"

  read -p "n8n 서버 URL (예: https://your-n8n.com): " SERVER_URL
  SERVER_URL="${SERVER_URL%/}" # 끝 슬래시 제거

  # 연결 테스트
  echo "연결 테스트 중..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${SERVER_URL}/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "000" ]; then
    echo "경고: 서버에 연결할 수 없습니다. URL을 확인해주세요."
    read -p "계속 진행할까요? (y/N): " CONTINUE
    [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]] && exit 1
  else
    echo "서버 응답 확인 (HTTP $HTTP_CODE)"
  fi

  read -p "n8n API 키: " SERVER_API_KEY

  # API 키 검증
  echo "API 키 검증 중..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
    -H "X-N8N-API-KEY: ${SERVER_API_KEY}" \
    "${SERVER_URL}/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "API 키 검증 성공!"
  else
    echo "경고: API 키 검증 실패 (HTTP $HTTP_CODE). n8n → Settings → API에서 키를 확인해주세요."
    read -p "계속 진행할까요? (y/N): " CONTINUE
    [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]] && exit 1
  fi

  read -sp "관리자 비밀번호 (기본: admin1234): " ADMIN_PASSWORD
  echo ""
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"

  NEXTAUTH_SECRET=$(openssl rand -base64 32)

  cat > "$ENV_FILE" <<ENVEOF
APP_NAME="n8n Admin"

SERVER_NAME="${SERVER_NAME}"
SERVER_URL=${SERVER_URL}
SERVER_API_KEY=${SERVER_API_KEY}

ADMIN_PASSWORD=${ADMIN_PASSWORD}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=http://localhost:3000
ENVEOF

  echo ".env 파일 생성 완료"
fi

# 4. Claude Code 연결
echo ""
echo "--- Claude Code 연결 ---"
if command -v claude &>/dev/null; then
  echo "Claude Code 감지됨: $(claude --version 2>/dev/null || echo '설치됨')"

  SETTINGS_FILE="$REPO_ROOT/.claude/settings.local.json"
  if [ -f "$SETTINGS_FILE" ]; then
    echo "MCP 설정 파일이 이미 존재합니다: $SETTINGS_FILE"
  else
    echo "n8n MCP 서버 설정은 Claude Code에서 자동으로 구성됩니다."
    echo "프로젝트 폴더에서 'claude'를 실행하면 n8n 스킬이 자동 로드됩니다."
  fi
else
  echo "Claude Code가 설치되어 있지 않습니다."
  echo "설치: npm install -g @anthropic-ai/claude-code"
  echo "(선택 사항 — n8n-admin 대시보드는 Claude Code 없이도 사용 가능합니다)"
fi

# 5. 완료
echo ""
echo "=== 셋업 완료! ==="
echo ""
echo "다음 단계:"
echo "  1. 웹 대시보드 실행:  cd admin && pnpm dev"
echo "  2. 브라우저에서 열기:  http://localhost:3000"
echo "  3. Claude Code 실행:  claude  (프로젝트 루트에서)"
echo ""
```

- [ ] **Step 2: 실행 권한 부여 + 테스트**

```bash
chmod +x setup.sh
```

스크립트가 문법 에러 없이 실행되는지 확인:
```bash
bash -n setup.sh
```
Expected: 출력 없음 (문법 오류 없음)

- [ ] **Step 3: 커밋**

```bash
git add setup.sh
git commit -m "feat: add interactive setup script for macOS/Linux"
```

---

### Task 6: Windows 셋업 스크립트

**Files:**
- Create: `setup.ps1`

- [ ] **Step 1: `setup.ps1` 작성**

```powershell
# n8n Admin 셋업 스크립트 (Windows PowerShell)
# 사용법: .\setup.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot
$EnvFile = Join-Path $RepoRoot ".env"

Write-Host "=== n8n Admin 셋업 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 필수 도구 확인
Write-Host "--- 필수 도구 확인 ---"
$Missing = @()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $Missing += "Node.js (https://nodejs.org)" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { $Missing += "pnpm (npm install -g pnpm)" }

if ($Missing.Count -gt 0) {
    Write-Host "다음 도구가 필요합니다:" -ForegroundColor Red
    foreach ($tool in $Missing) { Write-Host "  - $tool" }
    exit 1
}

$NodeVer = [int]((node -v) -replace 'v' -split '\.')[0]
if ($NodeVer -lt 18) {
    Write-Host "Node.js 18 이상이 필요합니다. 현재: $(node -v)" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $(node -v), pnpm $(pnpm -v) 확인 완료" -ForegroundColor Green

# 2. 의존성 설치
Write-Host ""
Write-Host "--- 의존성 설치 ---"
Push-Location admin; pnpm install; Pop-Location
npm install
Write-Host "의존성 설치 완료" -ForegroundColor Green

# 3. .env 파일 생성
Write-Host ""
Write-Host "--- 서버 설정 ---"
$SkipEnv = $false
if (Test-Path $EnvFile) {
    $Overwrite = Read-Host ".env 파일이 이미 있습니다. 덮어쓸까요? (y/N)"
    if ($Overwrite -ne "y") { $SkipEnv = $true; Write-Host ".env 파일을 유지합니다." }
}

if (-not $SkipEnv) {
    $ServerName = Read-Host "서버 이름 (기본: My n8n Server)"
    if ([string]::IsNullOrWhiteSpace($ServerName)) { $ServerName = "My n8n Server" }

    $ServerUrl = Read-Host "n8n 서버 URL (예: https://your-n8n.com)"
    $ServerUrl = $ServerUrl.TrimEnd('/')

    # 연결 테스트
    Write-Host "연결 테스트 중..."
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/v1/workflows?limit=1" -TimeoutSec 5 -UseBasicParsing
        Write-Host "서버 응답 확인 (HTTP $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "경고: 서버에 연결할 수 없습니다." -ForegroundColor Yellow
        $Continue = Read-Host "계속 진행할까요? (y/N)"
        if ($Continue -ne "y") { exit 1 }
    }

    $ApiKey = Read-Host "n8n API 키"

    # API 키 검증
    Write-Host "API 키 검증 중..."
    try {
        $headers = @{ "X-N8N-API-KEY" = $ApiKey; "Accept" = "application/json" }
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/v1/workflows?limit=1" -Headers $headers -TimeoutSec 5 -UseBasicParsing
        Write-Host "API 키 검증 성공!" -ForegroundColor Green
    } catch {
        Write-Host "경고: API 키 검증 실패. n8n -> Settings -> API에서 키를 확인해주세요." -ForegroundColor Yellow
        $Continue = Read-Host "계속 진행할까요? (y/N)"
        if ($Continue -ne "y") { exit 1 }
    }

    $AdminPassword = Read-Host "관리자 비밀번호 (기본: admin1234)"
    if ([string]::IsNullOrWhiteSpace($AdminPassword)) { $AdminPassword = "admin1234" }

    $NextAuthSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

    @"
APP_NAME="n8n Admin"

SERVER_NAME="$ServerName"
SERVER_URL=$ServerUrl
SERVER_API_KEY=$ApiKey

ADMIN_PASSWORD=$AdminPassword
NEXTAUTH_SECRET=$NextAuthSecret
NEXTAUTH_URL=http://localhost:3000
"@ | Set-Content -Path $EnvFile -Encoding UTF8

    Write-Host ".env 파일 생성 완료" -ForegroundColor Green
}

# 4. Claude Code 연결
Write-Host ""
Write-Host "--- Claude Code 연결 ---"
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "Claude Code 감지됨" -ForegroundColor Green
    Write-Host "프로젝트 폴더에서 'claude'를 실행하면 n8n 스킬이 자동 로드됩니다."
} else {
    Write-Host "Claude Code가 설치되어 있지 않습니다."
    Write-Host "설치: npm install -g @anthropic-ai/claude-code"
    Write-Host "(선택 사항 - n8n-admin 대시보드는 Claude Code 없이도 사용 가능합니다)"
}

# 5. 완료
Write-Host ""
Write-Host "=== 셋업 완료! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1. 웹 대시보드 실행:  cd admin; pnpm dev"
Write-Host "  2. 브라우저에서 열기:  http://localhost:3000"
Write-Host "  3. Claude Code 실행:  claude  (프로젝트 루트에서)"
Write-Host ""
```

- [ ] **Step 2: 커밋**

```bash
git add setup.ps1
git commit -m "feat: add interactive setup script for Windows"
```

---

### Task 7: 설정 페이지에 Claude Code 연결 섹션 추가

**Files:**
- Modify: `admin/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Claude Code 연결 섹션 추가**

기존 settings 페이지에 새 Card 섹션을 추가. 현재 페이지 구조(Gemini 설정 Card, 자동 정리 Card, 서버 설정 Card)에 맞춰 "Claude Code 연결" Card를 추가:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Claude Code 연결</CardTitle>
    <CardDescription>Claude Code에서 자연어로 n8n을 관리합니다</CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <p className="text-sm font-medium">1. Claude Code 설치</p>
      <div className="flex items-center gap-2">
        <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
          npm install -g @anthropic-ai/claude-code
        </code>
        <Button variant="outline" size="sm" onClick={() => copyToClipboard('npm install -g @anthropic-ai/claude-code')}>
          복사
        </Button>
      </div>
    </div>
    <div className="space-y-2">
      <p className="text-sm font-medium">2. 프로젝트 폴더에서 Claude Code 실행</p>
      <div className="flex items-center gap-2">
        <code className="bg-muted px-2 py-1 rounded text-sm flex-1">
          cd {repoPath} && claude
        </code>
        <Button variant="outline" size="sm" onClick={() => copyToClipboard(`cd ${repoPath} && claude`)}>
          복사
        </Button>
      </div>
    </div>
    <div className="space-y-2">
      <p className="text-sm font-medium">3. 사용 가능한 명령 예시</p>
      <ul className="text-sm text-muted-foreground space-y-1">
        <li>• "워크플로우 목록 보여줘"</li>
        <li>• "Slack 알림 워크플로우 만들어줘"</li>
        <li>• "에러 리포트 보여줘"</li>
      </ul>
    </div>
  </CardContent>
</Card>
```

`copyToClipboard` 유틸:
```typescript
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('클립보드에 복사했습니다')
}
```

- [ ] **Step 2: 커밋**

```bash
git add admin/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add Claude Code connection guide to settings page"
```

---

## Phase 2: 스킬 초보자 모드

### Task 8: SKILL.md 초보자 안내 추가

**Files:**
- Modify: `.claude/skills/n8n/SKILL.md`

- [ ] **Step 1: SKILL.md 상단에 초보자 환영 메시지 및 에러 가이드 추가**

기존 SKILL.md의 스킬 설명 섹션 뒤에 다음 두 섹션을 추가:

**초보자 환영 섹션:**
```markdown
## 시작 안내

이 스킬이 로드되면 사용자에게 다음 안내를 출력한다:

> n8n 관리 스킬이 로드되었습니다. 이런 명령을 해보세요:
> - "워크플로우 목록 보여줘"
> - "Slack 알림 워크플로우 만들어줘"
> - "전체 워크플로우 이름 컨벤션 정리해줘"
> - "에러 리포트 보여줘"
> - "홍길동 퇴사 인계 처리해줘"

## 안전 확인

모든 쓰기 작업(생성, 수정, 삭제, 일괄 변경) 실행 전에 반드시 사용자에게 확인을 구한다:

1. 수행할 작업을 요약한다 (대상, 변경 내용, 영향 범위)
2. "진행할까요?" 확인을 받는다
3. 확인 후 실행한다

예시:
> 워크플로우 '[CRON] 매일 아침 AI 브리핑'을 생성합니다.
> - 노드: Schedule Trigger → HTTP Request → OpenAI → Slack
> - 상태: 비활성 (수동 활성화 필요)
> 진행할까요?
```

**에러 가이드 섹션:**
```markdown
## 에러 대응 가이드

MCP 도구 호출 실패 시 아래 안내를 사용자에게 제공한다:

| 에러 상황 | 안내 |
|----------|------|
| MCP 연결 실패 / 도구 미발견 | "n8n MCP 서버가 연결되지 않았습니다. `./setup.sh`를 실행하거나 Settings 페이지에서 Claude Code 연결 가이드를 확인해주세요." |
| HTTP 401 / 인증 실패 | "API 키가 만료되었거나 잘못되었습니다. n8n → Settings → API에서 확인해주세요." |
| HTTP 403 / 권한 부족 | "이 작업에는 Owner 권한이 필요합니다. n8n 관리자에게 문의해주세요." |
| 노드 미발견 (search_nodes 결과 없음) | "이 노드는 커뮤니티 노드일 수 있습니다. n8n → Settings → Community Nodes에서 먼저 설치해주세요." |
| n8n_test_workflow 실패 (지원 안 됨) | "이 트리거 타입은 테스트를 지원하지 않습니다. n8n UI에서 수동으로 테스트해주세요." |
```

- [ ] **Step 2: 커밋**

```bash
git add .claude/skills/n8n/SKILL.md
git commit -m "feat: add beginner guide and error handling to n8n skill"
```

---

### Task 9: 스킬 모듈 개선

**Files:**
- Modify: `.claude/skills/n8n/references/workflow-builder.md`
- Modify: `.claude/skills/n8n/references/ops-manager.md`
- Modify: `.claude/skills/n8n/references/teaching-guide.md`

- [ ] **Step 1: workflow-builder.md에 미리보기 단계 추가**

기존 6단계 프로세스의 4단계(사전 검증)와 5단계(생성) 사이에 "사용자 미리보기" 단계를 삽입. 다음 내용을 "생성 프로세스" 섹션에 추가:

```markdown
### 4.5 사용자 미리보기 (생성 전 확인)

생성 실행 전에 사용자에게 다음 정보를 표로 보여주고 확인을 받는다:

| 항목 | 내용 |
|------|------|
| 워크플로우 이름 | 제안된 이름 |
| 트리거 | 트리거 노드 타입 + 설정 요약 |
| 노드 구성 | 전체 노드 목록 (순서대로) |
| 연결 | 노드 간 연결 흐름 |
| 초기 상태 | 비활성 (사용자가 수동 활성화) |

"위 구성으로 워크플로우를 생성합니다. 진행할까요?"
```

- [ ] **Step 2: ops-manager.md에 표 형식 포맷 가이드 추가**

기존 모니터링 섹션에 결과 포맷 가이드를 추가:

```markdown
### 결과 출력 포맷

모니터링/분석 결과는 표 형식으로 정리하여 보여준다:

**워크플로우 현황 예시:**
| # | 이름 | 상태 | 최근 실행 | 결과 |
|---|------|------|----------|------|
| 1 | [CRON] 매일 아침 AI 브리핑 | 활성 | 2026-03-26 09:00 | 성공 |
| 2 | [WEBHOOK] 고객 문의 분류 | 활성 | 2026-03-26 14:32 | 실패 |

**에러 리포트 예시:**
| # | 워크플로우 | 에러 타입 | 발생 시각 | 원인 요약 |
|---|----------|----------|----------|----------|
| 1 | 고객 문의 분류 | NodeOperationError | 03-26 14:32 | API 키 만료 |
```

- [ ] **Step 3: teaching-guide.md에 스킬 수정 가이드 추가**

기존 파일 끝에 "스킬 커스터마이징 가이드" 섹션을 추가:

```markdown
## 스킬 커스터마이징 가이드

수강생이 자기 업무에 맞게 스킬을 수정할 때 참고하는 가이드.

### 수정 가능한 부분
1. **SKILL.md의 라우팅 규칙** — 새로운 의도 키워드 추가 가능
2. **references/ 모듈** — 새 모듈 추가 또는 기존 모듈 확장
3. **에러 메시지** — 팀 상황에 맞는 안내 문구로 변경
4. **출력 포맷** — 표 형식, 리포트 양식 커스터마이징

### 새 모듈 추가 방법
1. `.claude/skills/n8n/references/` 폴더에 `my-module.md` 생성
2. SKILL.md의 라우팅 규칙에 새 의도 → 모듈 매핑 추가
3. 모듈 내에 MCP 도구 호출 절차 작성

### 주의사항
- MCP 도구 이름은 정확히 일치해야 한다 (예: `n8n_create_workflow`)
- 새 도구를 추가하려면 `.claude/settings.local.json`의 permissions에 등록 필요
```

- [ ] **Step 4: 커밋**

```bash
git add .claude/skills/n8n/references/workflow-builder.md \
       .claude/skills/n8n/references/ops-manager.md \
       .claude/skills/n8n/references/teaching-guide.md
git commit -m "feat: enhance skill modules with preview, formatting, and customization guides"
```

---

## Phase 3: 관리 기능

### Task 10: n8n-client.ts에 새 API 함수 추가

**Files:**
- Modify: `admin/lib/n8n-client.ts`
- Modify: `admin/lib/types.ts`

- [ ] **Step 1: types.ts에 새 타입 추가**

```typescript
interface BatchErrorTriggerResult {
  added: { id: string; name: string }[]
  alreadyHas: { id: string; name: string }[]
  failed: { id: string; name: string; error: string }[]
}

interface TransferResult {
  workflows: { id: string; name: string }[]
  credentials: { id: string; name: string }[]
  failed: { id: string; name: string; error: string }[]
}
```

- [ ] **Step 2: n8n-client.ts에 함수 추가**

```typescript
export async function getWorkflowsByUser(
  server: ServerConfig,
  userId: string,
): Promise<N8nWorkflow[]> {
  const allWorkflows = await listWorkflows(server)
  const projects = await listProjects(server)

  // userId의 personal 프로젝트 찾기
  // shared[].projectId로 필터링
  return allWorkflows.filter((wf) =>
    wf.shared?.some((s) => {
      const project = projects.find((p) => p.id === s.projectId)
      return project?.type === 'personal' && s.role === 'workflow:owner'
    })
  )
}

export async function transferWorkflowOwnership(
  server: ServerConfig,
  workflowId: string,
  newOwnerId: string,
): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/workflows/${workflowId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationProjectId: newOwnerId }),
  })
  if (!res.ok) throw new Error(`Failed to transfer workflow: ${res.status}`)
}

export async function transferCredentialOwnership(
  server: ServerConfig,
  credentialId: string,
  newOwnerId: string,
): Promise<void> {
  const res = await fetch(`${server.url}/api/v1/credentials/${credentialId}/transfer`, {
    method: 'PUT',
    headers: {
      'X-N8N-API-KEY': server.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ destinationProjectId: newOwnerId }),
  })
  if (!res.ok) throw new Error(`Failed to transfer credential: ${res.status}`)
}

export function workflowHasErrorTrigger(workflow: N8nWorkflow): boolean {
  return (workflow.nodes ?? []).some(
    (node: { type?: string }) => node.type === 'n8n-nodes-base.errorTrigger'
  )
}
```

- [ ] **Step 3: 커밋**

```bash
git add admin/lib/n8n-client.ts admin/lib/types.ts
git commit -m "feat: add transfer ownership and error trigger detection to n8n client"
```

---

### Task 11: 에러 트리거 일괄 등록 스크립트

**Files:**
- Create: `scripts/add-error-triggers.sh`

- [ ] **Step 1: `scripts/add-error-triggers.sh` 작성**

```bash
#!/bin/bash
# 에러 트리거가 없는 워크플로우에 일괄 등록
# 사용법: ./scripts/add-error-triggers.sh <server> [--dry-run] [--notify-type slack|webhook] [--notify-target "#channel"|"https://..."]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

SERVER="${1:?서버를 지정하세요 (server1, server2, server3)}"
shift
load_server_config "$SERVER"

DRY_RUN=false
NOTIFY_TYPE=""
NOTIFY_TARGET=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
    --notify-type) NOTIFY_TYPE="$2"; shift 2 ;;
    --notify-target) NOTIFY_TARGET="$2"; shift 2 ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

echo "=== 에러 트리거 일괄 등록 ==="
echo "서버: $SERVER ($N8N_URL)"
echo "모드: $([ "$DRY_RUN" = true ] && echo 'Dry-run (변경 없음)' || echo '실행')"
echo ""

# 전체 워크플로우 조회
echo "워크플로우 조회 중..."
ALL_WORKFLOWS=$(fetch_all "workflows")
TOTAL=$(echo "$ALL_WORKFLOWS" | jq 'length')
echo "전체 워크플로우: ${TOTAL}개"

# 활성 워크플로우 중 에러 트리거 없는 것 필터
MISSING=$(echo "$ALL_WORKFLOWS" | jq '[.[] | select(.active == true) | select((.nodes // []) | map(.type) | index("n8n-nodes-base.errorTrigger") | not)]')
MISSING_COUNT=$(echo "$MISSING" | jq 'length')
HAS_COUNT=$((TOTAL - MISSING_COUNT))

echo "에러 트리거 있음: ${HAS_COUNT}개"
echo "에러 트리거 없음 (활성): ${MISSING_COUNT}개"
echo ""

if [ "$MISSING_COUNT" -eq 0 ]; then
  echo "모든 활성 워크플로우에 에러 트리거가 등록되어 있습니다!"
  exit 0
fi

echo "에러 트리거가 없는 워크플로우:"
echo "$MISSING" | jq -r '.[] | "  - [\(.id)] \(.name)"'
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "(dry-run 모드 — 여기서 종료)"
  exit 0
fi

read -p "${MISSING_COUNT}개 워크플로우에 에러 트리거를 등록할까요? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "취소되었습니다."
  exit 0
fi

ADDED=0
FAILED=0

for ID in $(echo "$MISSING" | jq -r '.[].id'); do
  NAME=$(echo "$MISSING" | jq -r ".[] | select(.id==\"$ID\") | .name")
  echo -n "  [$ID] $NAME ... "

  # 워크플로우 상세 조회
  WF_DETAIL=$(curl -s -H "X-N8N-API-KEY: $API_KEY" -H "Accept: application/json" "$N8N_URL/api/v1/workflows/$ID")

  # Error Trigger 노드 추가
  ERROR_TRIGGER_NODE='{
    "parameters": {},
    "type": "n8n-nodes-base.errorTrigger",
    "typeVersion": 1,
    "position": [-200, 0],
    "id": "error-trigger-auto",
    "name": "Error Trigger"
  }'

  # 기존 노드에 Error Trigger 추가
  UPDATED_NODES=$(echo "$WF_DETAIL" | jq --argjson et "$ERROR_TRIGGER_NODE" '.nodes + [$et]')

  # 워크플로우 업데이트
  PATCH_BODY=$(echo "$WF_DETAIL" | jq --argjson nodes "$UPDATED_NODES" '{nodes: $nodes, connections: .connections, settings: .settings}')

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PATCH_BODY" \
    "$N8N_URL/api/v1/workflows/$ID")

  if [ "$HTTP_CODE" = "200" ]; then
    echo "추가됨"
    ADDED=$((ADDED + 1))
  else
    echo "실패 (HTTP $HTTP_CODE)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "=== 결과 ==="
echo "추가됨: ${ADDED}개"
echo "실패: ${FAILED}개"
echo "이미 있음: ${HAS_COUNT}개"
```

- [ ] **Step 2: 실행 권한 부여 + 문법 확인**

```bash
chmod +x scripts/add-error-triggers.sh
bash -n scripts/add-error-triggers.sh
```
Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
git add scripts/add-error-triggers.sh
git commit -m "feat: add batch error trigger registration script"
```

---

### Task 12: 퇴사자 인계 스크립트

**Files:**
- Create: `scripts/transfer-ownership.sh`

- [ ] **Step 1: `scripts/transfer-ownership.sh` 작성**

```bash
#!/bin/bash
# 퇴사자/담당자 변경 시 워크플로우 + 크레덴셜 소유권 이전
# 사용법: ./scripts/transfer-ownership.sh <server> --from <email> --to <email> [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

SERVER="${1:?서버를 지정하세요 (server1, server2, server3)}"
shift
load_server_config "$SERVER"

FROM_EMAIL=""
TO_EMAIL=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --from) FROM_EMAIL="$2"; shift 2 ;;
    --to) TO_EMAIL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$FROM_EMAIL" ] || [ -z "$TO_EMAIL" ]; then
  echo "사용법: $0 <server> --from <퇴사자이메일> --to <인수자이메일> [--dry-run]"
  exit 1
fi

echo "=== 소유권 이전 ==="
echo "서버: $SERVER ($N8N_URL)"
echo "보내는 사람: $FROM_EMAIL"
echo "받는 사람: $TO_EMAIL"
echo "모드: $([ "$DRY_RUN" = true ] && echo 'Dry-run (변경 없음)' || echo '실행')"
echo ""

# 유저 조회
ALL_USERS=$(fetch_all "users")

FROM_USER=$(echo "$ALL_USERS" | jq -r ".[] | select(.email==\"$FROM_EMAIL\")")
if [ -z "$FROM_USER" ] || [ "$FROM_USER" = "null" ]; then
  echo "오류: $FROM_EMAIL 유저를 찾을 수 없습니다."
  exit 1
fi
FROM_ID=$(echo "$FROM_USER" | jq -r '.id')
FROM_ROLE=$(echo "$FROM_USER" | jq -r '.role // "unknown"')
echo "보내는 사람: $FROM_EMAIL (ID: $FROM_ID, 역할: $FROM_ROLE)"

TO_USER=$(echo "$ALL_USERS" | jq -r ".[] | select(.email==\"$TO_EMAIL\")")
if [ -z "$TO_USER" ] || [ "$TO_USER" = "null" ]; then
  echo "오류: $TO_EMAIL 유저를 찾을 수 없습니다."
  exit 1
fi
TO_ID=$(echo "$TO_USER" | jq -r '.id')
echo "받는 사람: $TO_EMAIL (ID: $TO_ID)"

# 프로젝트 조회 (개인 프로젝트 매핑)
ALL_PROJECTS=$(curl -s -H "X-N8N-API-KEY: $API_KEY" -H "Accept: application/json" "$N8N_URL/api/v1/projects?limit=250")

# TO 유저의 personal 프로젝트 ID 찾기
TO_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\" and (.name | test(\"$TO_EMAIL\"; \"i\"))) | .id" | head -1)
if [ -z "$TO_PROJECT_ID" ] || [ "$TO_PROJECT_ID" = "null" ]; then
  echo "경고: $TO_EMAIL의 개인 프로젝트를 찾을 수 없습니다. 이름 기반 검색을 시도합니다..."
  TO_NAME=$(echo "$TO_USER" | jq -r '(.firstName // "") + " " + (.lastName // "")' | xargs)
  TO_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\" and (.name | test(\"$TO_NAME\"; \"i\"))) | .id" | head -1)
fi

if [ -z "$TO_PROJECT_ID" ] || [ "$TO_PROJECT_ID" = "null" ]; then
  echo "오류: 인수자의 개인 프로젝트를 찾을 수 없습니다."
  exit 1
fi
echo "인수자 프로젝트: $TO_PROJECT_ID"
echo ""

# 워크플로우 조회
echo "--- 워크플로우 ---"
ALL_WORKFLOWS=$(fetch_all "workflows")
FROM_WORKFLOWS=$(echo "$ALL_WORKFLOWS" | jq "[.[] | select(.shared[]? | select(.role==\"workflow:owner\") | .projectId) as \$pid | select(true)]")
# 간소화: FROM 유저의 개인 프로젝트에 속한 워크플로우 찾기
FROM_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\" and (.name | test(\"$FROM_EMAIL\"; \"i\"))) | .id" | head -1)
if [ -z "$FROM_PROJECT_ID" ]; then
  FROM_NAME=$(echo "$FROM_USER" | jq -r '(.firstName // "") + " " + (.lastName // "")' | xargs)
  FROM_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\" and (.name | test(\"$FROM_NAME\"; \"i\"))) | .id" | head -1)
fi

OWNED_WORKFLOWS=$(echo "$ALL_WORKFLOWS" | jq --arg pid "$FROM_PROJECT_ID" '[.[] | select(.shared[]? | .projectId == $pid and .role == "workflow:owner")]')
WF_COUNT=$(echo "$OWNED_WORKFLOWS" | jq 'length')
echo "소유 워크플로우: ${WF_COUNT}개"
echo "$OWNED_WORKFLOWS" | jq -r '.[] | "  - [\(.id)] \(.name) (active: \(.active))"'

# 크레덴셜 조회
echo ""
echo "--- 크레덴셜 ---"
ALL_CREDENTIALS=$(fetch_all "credentials")
OWNED_CREDENTIALS=$(echo "$ALL_CREDENTIALS" | jq --arg pid "$FROM_PROJECT_ID" '[.[] | select(.homeProject?.id == $pid)]')
CRED_COUNT=$(echo "$OWNED_CREDENTIALS" | jq 'length')
echo "소유 크레덴셜: ${CRED_COUNT}개"
echo "$OWNED_CREDENTIALS" | jq -r '.[] | "  - [\(.id)] \(.name) (\(.type))"'

echo ""
echo "총 이전 대상: 워크플로우 ${WF_COUNT}개 + 크레덴셜 ${CRED_COUNT}개"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "(dry-run 모드 — 여기서 종료)"
  exit 0
fi

if [ "$WF_COUNT" -eq 0 ] && [ "$CRED_COUNT" -eq 0 ]; then
  echo "이전할 자산이 없습니다."
  exit 0
fi

echo ""
read -p "위 자산을 $TO_EMAIL에게 이전할까요? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "취소되었습니다."
  exit 0
fi

WF_OK=0
WF_FAIL=0
CRED_OK=0
CRED_FAIL=0

# 워크플로우 이전
for ID in $(echo "$OWNED_WORKFLOWS" | jq -r '.[].id'); do
  NAME=$(echo "$OWNED_WORKFLOWS" | jq -r ".[] | select(.id==\"$ID\") | .name")
  echo -n "  워크플로우 [$ID] $NAME ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"destinationProjectId\": \"$TO_PROJECT_ID\"}" \
    "$N8N_URL/api/v1/workflows/$ID/transfer")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "이전 완료"
    WF_OK=$((WF_OK + 1))
  else
    echo "실패 (HTTP $HTTP_CODE)"
    WF_FAIL=$((WF_FAIL + 1))
  fi
done

# 크레덴셜 이전
for ID in $(echo "$OWNED_CREDENTIALS" | jq -r '.[].id'); do
  NAME=$(echo "$OWNED_CREDENTIALS" | jq -r ".[] | select(.id==\"$ID\") | .name")
  echo -n "  크레덴셜 [$ID] $NAME ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"destinationProjectId\": \"$TO_PROJECT_ID\"}" \
    "$N8N_URL/api/v1/credentials/$ID/transfer")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "이전 완료"
    CRED_OK=$((CRED_OK + 1))
  else
    echo "실패 (HTTP $HTTP_CODE)"
    CRED_FAIL=$((CRED_FAIL + 1))
  fi
done

echo ""
echo "=== 결과 ==="
echo "워크플로우: 성공 ${WF_OK}개, 실패 ${WF_FAIL}개"
echo "크레덴셜: 성공 ${CRED_OK}개, 실패 ${CRED_FAIL}개"
```

- [ ] **Step 2: 실행 권한 부여 + 문법 확인**

```bash
chmod +x scripts/transfer-ownership.sh
bash -n scripts/transfer-ownership.sh
```
Expected: 출력 없음

- [ ] **Step 3: 커밋**

```bash
git add scripts/transfer-ownership.sh
git commit -m "feat: add ownership transfer script for resignation handover"
```

---

### Task 13: 에러 트리거 일괄 등록 API + UI

**Files:**
- Create: `admin/app/api/servers/[server]/workflows/batch-error-triggers/route.ts`
- Modify: `admin/app/(dashboard)/workflows/workflows-client.tsx`

- [ ] **Step 1: API 라우트 작성**

`admin/app/api/servers/[server]/workflows/batch-error-triggers/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import { listWorkflows, getWorkflow, updateWorkflow, workflowHasErrorTrigger } from '@/lib/n8n-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ server: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const workflows = await listWorkflows(server)

    const active = workflows.filter((wf) => wf.active)
    const withTrigger = active.filter(workflowHasErrorTrigger)
    const withoutTrigger = active.filter((wf) => !workflowHasErrorTrigger(wf))

    return NextResponse.json({
      total: workflows.length,
      active: active.length,
      withErrorTrigger: withTrigger.length,
      withoutErrorTrigger: withoutTrigger.map((wf) => ({ id: wf.id, name: wf.name })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ server: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const body = await req.json()
    const { workflowIds } = body as { workflowIds: string[] }

    const results = { added: [] as string[], failed: [] as { id: string; error: string }[] }

    for (const id of workflowIds) {
      try {
        const wf = await getWorkflow(server, id)
        if (workflowHasErrorTrigger(wf)) continue

        const errorTriggerNode = {
          parameters: {},
          type: 'n8n-nodes-base.errorTrigger',
          typeVersion: 1,
          position: [-200, 0],
          id: `error-trigger-${id}`,
          name: 'Error Trigger',
        }

        const updatedNodes = [...(wf.nodes ?? []), errorTriggerNode]
        await updateWorkflow(server, id, { ...wf, nodes: updatedNodes })
        results.added.push(id)
      } catch (e) {
        results.failed.push({ id, error: String(e) })
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: workflows-client.tsx에 에러 트리거 컬럼 + 일괄 등록 버튼 추가**

테이블에 "에러 트리거" 컬럼 추가:
```tsx
<TableHead>에러 트리거</TableHead>
// ...
<TableCell>
  {workflowHasErrorTrigger(wf) ? (
    <Badge variant="outline" className="text-green-600">있음</Badge>
  ) : (
    <Badge variant="outline" className="text-red-600">없음</Badge>
  )}
</TableCell>
```

`workflowHasErrorTrigger` 클라이언트 유틸:
```typescript
function workflowHasErrorTrigger(wf: N8nWorkflow): boolean {
  return (wf.nodes ?? []).some(
    (node: { type?: string }) => node.type === 'n8n-nodes-base.errorTrigger'
  )
}
```

상단에 경고 배너 + 일괄 등록 버튼:
```tsx
const missingCount = workflows.filter((wf) => wf.active && !workflowHasErrorTrigger(wf)).length

{missingCount > 0 && !isDemoMode && (
  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
    <span className="text-sm text-orange-800">
      에러 트리거 없는 활성 워크플로우: {missingCount}개
    </span>
    <Button variant="outline" size="sm" onClick={handleBatchErrorTriggers}>
      일괄 등록
    </Button>
  </div>
)}
```

`handleBatchErrorTriggers` mutation:
```typescript
const batchErrorTriggerMutation = useMutation({
  mutationFn: async () => {
    const missing = workflows
      .filter((wf) => wf.active && !workflowHasErrorTrigger(wf))
      .map((wf) => wf.id)
    const res = await fetch(`/api/servers/${server}/workflows/batch-error-triggers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowIds: missing }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  },
  onSuccess: (data) => {
    toast.success(`에러 트리거 ${data.added.length}개 등록 완료`)
    qc.invalidateQueries({ queryKey: ['workflows-all', server] })
  },
  onError: () => toast.error('일괄 등록에 실패했습니다'),
})
```

- [ ] **Step 3: 커밋**

```bash
git add admin/app/api/servers/\[server\]/workflows/batch-error-triggers/route.ts \
       admin/app/\(dashboard\)/workflows/workflows-client.tsx
git commit -m "feat: add batch error trigger registration API and UI"
```

---

### Task 14: 퇴사자 인계 API + UI

**Files:**
- Create: `admin/app/api/servers/[server]/users/[id]/transfer/route.ts`
- Modify: `admin/app/(dashboard)/users/users-client.tsx`

- [ ] **Step 1: API 라우트 작성**

`admin/app/api/servers/[server]/users/[id]/transfer/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServer } from '@/lib/server-config'
import {
  listWorkflows,
  listCredentials,
  listProjects,
  transferWorkflowOwnership,
  transferCredentialOwnership,
} from '@/lib/n8n-client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ server: string; id: string }> },
) {
  try {
    const { server: serverId, id: userId } = await params
    const server = getServer(serverId)

    const [workflows, credentials, projects] = await Promise.all([
      listWorkflows(server),
      listCredentials(server),
      listProjects(server),
    ])

    const userProject = projects.find(
      (p) => p.type === 'personal' && p.id.includes(userId),
    )

    const ownedWorkflows = userProject
      ? workflows.filter((wf) =>
          wf.shared?.some((s) => s.projectId === userProject.id && s.role === 'workflow:owner'),
        )
      : []

    const ownedCredentials = userProject
      ? credentials.filter((c: { homeProject?: { id: string } }) =>
          c.homeProject?.id === userProject.id,
        )
      : []

    return NextResponse.json({
      workflows: ownedWorkflows.map((wf) => ({ id: wf.id, name: wf.name, active: wf.active })),
      credentials: ownedCredentials.map((c) => ({ id: c.id, name: c.name, type: c.type })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ server: string; id: string }> },
) {
  try {
    const { server: serverId } = await params
    const server = getServer(serverId)
    const { targetProjectId, workflowIds, credentialIds } = await req.json()

    const results = {
      workflows: [] as string[],
      credentials: [] as string[],
      failed: [] as { id: string; error: string }[],
    }

    for (const wfId of workflowIds ?? []) {
      try {
        await transferWorkflowOwnership(server, wfId, targetProjectId)
        results.workflows.push(wfId)
      } catch (e) {
        results.failed.push({ id: wfId, error: String(e) })
      }
    }

    for (const credId of credentialIds ?? []) {
      try {
        await transferCredentialOwnership(server, credId, targetProjectId)
        results.credentials.push(credId)
      } catch (e) {
        results.failed.push({ id: credId, error: String(e) })
      }
    }

    return NextResponse.json(results)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
```

- [ ] **Step 2: users-client.tsx에 인계 기능 추가**

유저 목록 테이블 액션에 "인계" 버튼 추가. 클릭 시 Dialog:

```tsx
// 유저 자산 조회 query
const { data: userAssets } = useQuery({
  queryKey: ['user-assets', server, selectedUserId],
  queryFn: async () => {
    const res = await fetch(`/api/servers/${server}/users/${selectedUserId}/transfer`)
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  },
  enabled: !!selectedUserId,
})

// 인계 Dialog
<Dialog open={!!selectedUserId} onOpenChange={() => setSelectedUserId(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>소유권 인계</DialogTitle>
      <DialogDescription>
        {selectedUserEmail}의 자산을 다른 사용자에게 이전합니다.
      </DialogDescription>
    </DialogHeader>

    {userAssets && (
      <div className="space-y-3">
        <p className="text-sm">워크플로우 {userAssets.workflows.length}개, 크레덴셜 {userAssets.credentials.length}개</p>

        <Select value={targetProjectId} onValueChange={setTargetProjectId}>
          <SelectTrigger><SelectValue placeholder="인수자 선택" /></SelectTrigger>
          <SelectContent>
            {users.filter(u => u.id !== selectedUserId).map(u => (
              <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={() => transferMutation.mutate()}
          disabled={!targetProjectId || transferMutation.isPending}
        >
          {transferMutation.isPending ? '이전 중...' : '인계 실행'}
        </Button>
      </div>
    )}
  </DialogContent>
</Dialog>
```

Transfer mutation:
```typescript
const transferMutation = useMutation({
  mutationFn: async () => {
    const res = await fetch(`/api/servers/${server}/users/${selectedUserId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetProjectId,
        workflowIds: userAssets.workflows.map((w: { id: string }) => w.id),
        credentialIds: userAssets.credentials.map((c: { id: string }) => c.id),
      }),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return res.json()
  },
  onSuccess: (data) => {
    toast.success(`워크플로우 ${data.workflows.length}개, 크레덴셜 ${data.credentials.length}개 이전 완료`)
    setSelectedUserId(null)
    qc.invalidateQueries({ queryKey: ['users', server] })
  },
  onError: () => toast.error('인계에 실패했습니다'),
})
```

- [ ] **Step 3: 커밋**

```bash
git add admin/app/api/servers/\[server\]/users/\[id\]/transfer/route.ts \
       admin/app/\(dashboard\)/users/users-client.tsx
git commit -m "feat: add ownership transfer API and UI for resignation handover"
```

---

### Task 15: ops-manager.md에 에러 트리거 + 퇴사자 인계 섹션 추가

**Files:**
- Modify: `.claude/skills/n8n/references/ops-manager.md`

- [ ] **Step 1: 에러 트리거 관리 섹션 추가**

```markdown
## 에러 트리거 관리

### 현황 조회
"에러 트리거 현황 보여줘" 요청 시:
1. `n8n_list_workflows`로 전체 워크플로우 조회
2. 각 워크플로우의 nodes에서 `n8n-nodes-base.errorTrigger` 존재 여부 확인
3. 결과를 표로 출력:

| # | 워크플로우 | 상태 | 에러 트리거 |
|---|----------|------|-----------|
| 1 | [CRON] 매일 아침 AI 브리핑 | 활성 | 있음 |
| 2 | [WEBHOOK] 고객 문의 분류 | 활성 | **없음** |

### 일괄 등록
"전체 워크플로우에 에러 트리거 등록해줘" 요청 시:
1. 에러 트리거가 없는 활성 워크플로우 목록을 보여주고 확인을 구한다
2. 확인 후 각 워크플로우에 Error Trigger 노드를 추가한다:
   - `n8n_get_workflow`로 현재 상태 조회
   - nodes 배열에 errorTrigger 노드 추가
   - `n8n_update_full_workflow`로 저장
3. 결과 리포트 출력
```

- [ ] **Step 2: 퇴사자 인계 섹션 추가**

```markdown
## 퇴사자 인계

### 소유 자산 조회
"홍길동 퇴사 인계 처리해줘" 또는 "user@email.com의 자산 보여줘" 요청 시:
1. `n8n_list_workflows`로 전체 워크플로우 조회
2. shared 필드에서 해당 유저의 personal project가 owner인 워크플로우 필터링
3. 결과를 표로 출력:

| # | 유형 | 이름 | 상태 |
|---|------|------|------|
| 1 | 워크플로우 | [CRON] 매일 아침 AI 브리핑 | 활성 |
| 2 | 워크플로우 | [WEBHOOK] 고객 문의 분류 | 활성 |
| 3 | 크레덴셜 | OpenAI API | - |

### 소유권 이전
인수자를 확인한 후:
1. 이전할 자산 목록과 인수자를 보여주고 확인을 구한다
2. 워크플로우: `PUT /api/v1/workflows/{id}/transfer` (body: { destinationProjectId })
3. 크레덴셜: `PUT /api/v1/credentials/{id}/transfer` (body: { destinationProjectId })
4. 결과 리포트 출력

### 휴면 유저 위험 감지
"휴면 유저 중 워크플로우 가진 사람 보여줘" 요청 시:
1. 유저 목록에서 90일+ 미접속 유저 필터링
2. 각 휴면 유저의 소유 워크플로우 개수 조회
3. 워크플로우를 보유한 휴면 유저만 표로 출력
```

- [ ] **Step 3: 커밋**

```bash
git add .claude/skills/n8n/references/ops-manager.md
git commit -m "feat: add error trigger and ownership transfer sections to ops-manager skill"
```

---

## Phase 4: 배포

### Task 16: Windows Electron 빌드 설정

**Files:**
- Modify: `electron-builder.yml`
- Create: `build/icon.ico`

- [ ] **Step 1: Windows 아이콘 생성**

기존 `build/icon.iconset/icon_256x256.png`에서 `.ico` 파일 생성:

```bash
# macOS에서 실행 (sips + iconutil 대안)
# png2ico가 없으면 ImageMagick 사용
convert build/icon.iconset/icon_256x256.png \
  -define icon:auto-resize=256,128,64,48,32,16 \
  build/icon.ico
```

ImageMagick이 없으면 온라인 변환 도구 사용 후 `build/icon.ico`로 저장.

- [ ] **Step 2: electron-builder.yml에 win 섹션 추가**

기존 파일 끝에 추가:

```yaml
win:
  target:
    - target: nsis
      arch:
        - x64
  icon: build/icon.ico
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: n8n Admin
```

- [ ] **Step 3: build-desktop.sh에 플랫폼 옵션 추가**

기존 `npx electron-builder --mac` 라인을 조건부로 변경:

```bash
# 기존:
# npx electron-builder --mac

# 변경:
PLATFORM="${1:-auto}"  # auto, mac, win, all

case "$PLATFORM" in
  mac)   npx electron-builder --mac ;;
  win)   npx electron-builder --win ;;
  all)   npx electron-builder --mac --win ;;
  auto)
    if [[ "$(uname)" == "Darwin" ]]; then
      npx electron-builder --mac
    else
      npx electron-builder --win
    fi
    ;;
  *) echo "사용법: $0 [mac|win|all|auto]"; exit 1 ;;
esac
```

참고: 스크립트 시작 부분의 `set -e` 뒤에 PLATFORM 파싱을 추가하고, 기존 `echo "=== 4/4: ..."` 부분을 위 코드로 교체.

- [ ] **Step 4: 커밋**

```bash
git add electron-builder.yml build/icon.ico scripts/build-desktop.sh
git commit -m "feat: add Windows NSIS installer build support"
```

---

### Task 17: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/build-desktop.yml`

- [ ] **Step 1: 워크플로우 파일 작성**

```yaml
name: Build Desktop App

on:
  push:
    tags:
      - 'v*'

jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        run: npm install -g pnpm@10.28.2

      - name: Install dependencies
        run: |
          npm install
          cd admin && pnpm install --frozen-lockfile

      - name: Build Next.js standalone
        run: cd admin && pnpm build

      - name: Prepare standalone
        run: |
          rm -rf build/standalone
          mkdir -p build/standalone
          rsync -aL --exclude='**/@img+sharp-*' --exclude='**/*.map' admin/.next/standalone/ build/standalone/
          mkdir -p build/standalone/admin/.next
          rsync -aL admin/.next/static/ build/standalone/admin/.next/static/
          rsync -aL admin/public/ build/standalone/admin/public/

      - name: Compile Electron
        run: npx tsc -p desktop/tsconfig.json

      - name: Build DMG
        run: npx electron-builder --mac
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        with:
          name: mac-dmg
          path: dist/*.dmg

  build-win:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install pnpm
        run: npm install -g pnpm@10.28.2

      - name: Install dependencies
        run: |
          npm install
          cd admin && pnpm install --frozen-lockfile

      - name: Build Next.js standalone
        run: cd admin && pnpm build

      - name: Prepare standalone
        shell: pwsh
        run: |
          Remove-Item -Recurse -Force build/standalone -ErrorAction SilentlyContinue
          New-Item -ItemType Directory -Path build/standalone -Force
          Copy-Item -Recurse -Force admin/.next/standalone/* build/standalone/
          New-Item -ItemType Directory -Path build/standalone/admin/.next -Force
          Copy-Item -Recurse -Force admin/.next/static build/standalone/admin/.next/static
          Copy-Item -Recurse -Force admin/public build/standalone/admin/public

      - name: Compile Electron
        run: npx tsc -p desktop/tsconfig.json

      - name: Build exe
        run: npx electron-builder --win
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - uses: actions/upload-artifact@v4
        with:
          name: win-exe
          path: dist/*.exe

  release:
    needs: [build-mac, build-win]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            artifacts/mac-dmg/*.dmg
            artifacts/win-exe/*.exe
          generate_release_notes: true
```

- [ ] **Step 2: 커밋**

```bash
mkdir -p .github/workflows
git add .github/workflows/build-desktop.yml
git commit -m "feat: add GitHub Actions for cross-platform desktop builds"
```

---

## 완료 확인

모든 Task 완료 후 최종 점검:

- [ ] `./setup.sh` 실행하여 셋업 흐름 확인 (macOS)
- [ ] `cd admin && pnpm dev` 실행하여 위자드 + 데모 모드 확인
- [ ] 워크플로우 페이지에서 에러 트리거 컬럼 확인
- [ ] 유저 페이지에서 인계 버튼 확인
- [ ] `npx electron-builder --mac` 빌드 성공 확인
- [ ] Claude Code에서 n8n 스킬 로드 + 초보자 안내 출력 확인

---

_Total: 17 Tasks across 4 Phases_
