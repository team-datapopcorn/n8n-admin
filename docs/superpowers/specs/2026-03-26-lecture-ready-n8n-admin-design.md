# n8n-admin 강의용 제품화 설계

> 인프런 강의 "Claude Code로 시작하는 n8n 자동화 운영 실전" 수강생이 n8n-admin을 바로 사용할 수 있도록 제품화하는 설계 문서

**작성일:** 2026-03-26
**상태:** 승인됨

---

## 배경

n8n-admin은 현재 약 80% 완성도로, 웹 대시보드 + Electron 앱 + CLI 스크립트 + Claude Code 스킬이 구현되어 있다. 그러나 강의 수강생(비개발자 포함)이 바로 사용하기에는 다음 갭이 존재한다:

- 미구현 기능 2개 (에러 트리거 일괄 등록, 퇴사자 인계)
- Windows 미지원 (macOS DMG만 존재)
- 초보자 친화적 온보딩 부재 (설정 위자드, 데모 모드 없음)
- Claude Code 스킬 사용 허들 (MCP 설정, 에러 대응)

## 목표

수강생이 아래 두 경로 중 하나로 5분 내에 시작할 수 있어야 한다:

1. **GUI 경로**: DMG/exe 다운로드 → 설치 → 위자드에서 URL/API 키 입력 → 사용
2. **CLI 경로**: GitHub 클론 → `./setup.sh` 실행 → 대화형 설정 → 사용

n8n 서버가 없는 수강생도 데모 모드로 UI를 둘러볼 수 있어야 한다.

## 대상 사용자

- n8n 기본 사용 경험이 있는 비개발자
- 터미널 경험이 거의 없는 수강생
- macOS 및 Windows 사용자

---

## Phase 1: 첫 실행 경험 (섹션 1 대응)

### 1-1. 가이드형 설정 위자드

**변경 대상:** `admin/app/setup/` 페이지 리팩토링

**위자드 흐름:**

```
Step 1: 환영
  → "n8n Admin에 오신 것을 환영합니다!"
  → [서버 연결하기] 버튼 + [서버 없이 둘러보기] 버튼

Step 2: n8n URL 입력
  → 텍스트 입력 + 실시간 연결 테스트 (health_check API)
  → 성공: 초록 체크 + n8n 버전 표시
  → 실패: 친절한 에러 메시지 ("URL을 확인해주세요. 예: https://your-n8n.com")

Step 3: API 키 입력
  → 텍스트 입력 + 키 유효성 검증 (워크플로우 목록 조회)
  → 성공: "워크플로우 N개를 발견했습니다!"
  → 실패: "API 키가 올바르지 않습니다. n8n → Settings → API에서 키를 확인해주세요"

Step 4: 완료
  → "설정이 완료되었습니다!" + 요약 (서버 URL, 워크플로우 수, 유저 수)
  → [대시보드로 이동] 버튼
```

**기술 결정:**

- Electron 앱과 웹 버전 모두 동일한 위자드 컴포넌트 사용
- 설정값 저장: Electron은 `electron-store`, 웹은 `.env` + NextAuth session
- 기존 `setup/` 페이지의 서버 입력 폼을 스텝 형태로 리팩토링

### 1-2. 데모 모드

**변경 대상:** 새 파일 `admin/lib/demo-data.ts` + API 레이어 분기

**동작:**

- 설정 위자드 Step 1에서 "서버 없이 둘러보기" 선택 시 활성화
- mock 데이터: 워크플로우 5개, 유저 3명, 크레덴셜 4개 (다양한 상태 포함)
- 모든 페이지 상단에 노란색 배너: "데모 모드 — 실제 n8n 서버를 연결하면 사라집니다"
- 읽기 전용: 생성/수정/삭제 버튼 비활성화 (tooltip: "데모 모드에서는 사용할 수 없습니다")
- API 레이어에서 분기: 데모 모드이면 mock 반환, 아니면 실제 n8n API 호출

**mock 데이터 설계:**

```typescript
// admin/lib/demo-data.ts
export const DEMO_WORKFLOWS = [
  { id: "1", name: "[CRON] 매일 아침 AI 브리핑", active: true, ... },
  { id: "2", name: "[WEBHOOK] 고객 문의 자동 분류", active: true, ... },
  { id: "3", name: "[TRIGGER] 에러 알림 → Slack", active: true, ... },
  { id: "4", name: "Copy of My Workflow (1)", active: false, ... },  // 정리 대상 예시
  { id: "5", name: "test", active: false, ... },  // 정리 대상 예시
];
```

### 1-3. 원클릭 셋업 스크립트

**새 파일:** `setup.sh` (macOS/Linux), `setup.ps1` (Windows)

**`setup.sh` 동작:**

1. 필수 도구 확인 (Node.js ≥18, pnpm, jq)
   - 없으면: "Node.js가 필요합니다. https://nodejs.org 에서 설치해주세요"
2. `cd admin && pnpm install`
3. 대화형 `.env` 생성:
   - n8n URL 입력 → `curl` 연결 테스트
   - API 키 입력 → API 호출 검증
   - ADMIN_PASSWORD 설정 (기본값 제안)
   - NEXTAUTH_SECRET 자동 생성 (`openssl rand -base64 32`)
4. Claude Code 설치 여부 확인 (`which claude`)
   - 미설치: 설치 안내 메시지 출력
   - 설치됨: `.claude/settings.local.json`에 n8n MCP 서버 자동 등록
5. 완료 메시지 + 다음 단계 안내

**`setup.ps1` 동작:** 동일 흐름, PowerShell 문법. `jq` 대신 `ConvertFrom-Json` 사용.

**멱등성:** `.env` 이미 존재 시 "기존 설정이 있습니다. 덮어쓸까요? (y/N)" 확인

### 1-4. 앱 내 "Claude Code 연결" 버튼

**변경 대상:** `admin/app/(dashboard)/settings/` 페이지에 새 섹션 추가

**UI:**

```
┌─────────────────────────────────────────┐
│ 🤖 Claude Code 연결                     │
│                                         │
│ 상태: ⚪ 연결 안 됨                      │
│                                         │
│ Claude Code에서 자연어로 n8n을 관리하려면 │
│ MCP 서버 설정이 필요합니다.              │
│                                         │
│ 1. Claude Code 설치                     │
│    npm install -g @anthropic-ai/claude-code │
│                                [복사]   │
│                                         │
│ 2. MCP 설정 파일에 아래 내용 추가        │
│    {설정 JSON 자동 생성}       [복사]   │
│                                         │
│ 3. 프로젝트 폴더에서 claude 실행         │
│    cd n8n-admin && claude      [복사]   │
└─────────────────────────────────────────┘
```

- 사용자의 n8n URL/API 키를 기반으로 `settings.local.json` 내용 자동 생성
- "복사" 버튼으로 클립보드에 복사

---

## Phase 2: 스킬 사용 경험 (섹션 2~3 대응)

### 2-1. 스킬 초보자 모드

**변경 대상:** `.claude/skills/n8n/SKILL.md`, `references/*.md`

**SKILL.md 변경:**

- 스킬 시작 시 사용자에게 인사 + 사용 가능한 명령 예시 5개 출력:
  ```
  n8n 관리 스킬이 로드되었습니다. 이런 명령을 해보세요:
  • "워크플로우 목록 보여줘"
  • "Slack 알림 워크플로우 만들어줘"
  • "전체 워크플로우 이름 컨벤션 정리해줘"
  • "에러 리포트 보여줘"
  • "홍길동 퇴사 인계 처리해줘"
  ```
- 모든 쓰기 작업(생성/수정/삭제) 전 확인 단계 추가:
  ```
  "워크플로우 '[CRON] 매일 아침 AI 브리핑'을 생성합니다.
   - 노드: Schedule Trigger → HTTP Request → OpenAI → Slack
   - 상태: 비활성 (수동 활성화 필요)
   진행할까요?"
  ```

**에러 시 친절한 안내 (SKILL.md에 에러 핸들링 섹션 추가):**

| 에러 상황 | 안내 메시지 |
|----------|------------|
| MCP 연결 실패 | "n8n MCP 서버가 연결되지 않았습니다. setup.sh를 실행하거나 설정 페이지에서 연결해주세요" |
| API 키 오류 | "API 키가 만료되었거나 잘못되었습니다. n8n → Settings → API에서 확인해주세요" |
| 노드 미설치 | "이 노드는 커뮤니티 노드입니다. n8n에서 먼저 설치가 필요합니다" |
| 권한 부족 | "이 작업에는 Owner 권한이 필요합니다. n8n 관리자에게 문의해주세요" |

**references/ 모듈 개선:**

- `workflow-builder.md`: 생성 전 "이 워크플로우는 이런 노드들을 사용합니다" 미리보기 단계 추가
- `ops-manager.md`: 모니터링 결과를 표 형태로 정리하는 포맷 가이드 추가
- `teaching-guide.md`: "스킬 수정 가이드" 섹션 추가 — 수강생이 자기 업무에 맞게 커스터마이징할 때 참고

---

## Phase 3: 관리 기능 (섹션 4~5 대응)

### 3-1. 에러 트리거 일괄 등록

세 곳에서 동일 기능을 제공한다: 스크립트, 대시보드 UI, 클로드 스킬.

**새 파일: `scripts/add-error-triggers.sh`**

```bash
./scripts/add-error-triggers.sh server1 [--dry-run] [--notify-type slack|email|webhook] [--notify-target "#channel"|"email@..."|"https://..."]
```

동작:
1. 모든 활성 워크플로우 조회
2. 각 워크플로우의 노드에서 Error Trigger 존재 여부 확인
3. `--dry-run`: 미등록 워크플로우 목록만 출력
4. 실행 모드: Error Trigger 노드 + 알림 노드 추가 → `PATCH /workflows/{id}`
5. 결과 리포트 출력 (성공 N개, 이미 있음 M개, 실패 K개)

**대시보드 UI: 워크플로우 페이지 개선**

- 워크플로우 목록 테이블에 "에러 트리거" 컬럼 추가 (✅ / ❌)
- 페이지 상단에 경고 배너: "에러 트리거 없는 워크플로우: N개" (N > 0일 때만)
- "일괄 등록" 버튼 → 모달: 알림 채널 선택 (Slack/Email/Webhook) → 대상 URL 입력 → 확인 → 실행
- API 엔드포인트: `POST /api/servers/[server]/workflows/batch-error-triggers`

**클로드 스킬: `ops-manager.md` 추가**

- "에러 트리거 현황 보여줘" → 미등록 워크플로우 목록 표로 출력
- "전체 워크플로우에 에러 트리거 등록해줘" → 알림 채널 확인 → 일괄 실행 → 결과 리포트

### 3-2. 퇴사자 인계

**새 파일: `scripts/transfer-ownership.sh`**

```bash
./scripts/transfer-ownership.sh server1 --from "user@email.com" --to "newowner@email.com" [--dry-run]
```

동작:
1. `--from` 유저의 소유 워크플로우 조회 + 목록 출력
2. `--from` 유저의 소유 크레덴셜 조회 + 목록 출력
3. `--dry-run`: 목록만 출력하고 종료
4. 실행 모드: 확인 프롬프트 → 워크플로우 소유권 이전 (`PATCH`) → 크레덴셜 소유권 이전 (`PATCH`)
5. 결과 리포트 (이전 성공 N개, 실패 M개)

**대시보드 UI: 유저 페이지 개선**

- 유저 목록에서 유저 클릭 → 유저 상세 뷰 확장
  - "이 유저의 워크플로우 N개, 크레덴셜 M개"
  - [인계] 버튼 → 인수자 선택 드롭다운 → 확인 → 실행
  - 결과 토스트 알림 + 요약
- API 엔드포인트: `POST /api/servers/[server]/users/[id]/transfer`

**클로드 스킬: `ops-manager.md` 추가**

- "홍길동 퇴사 인계 처리해줘" → 소유 자산 조회 → 인수자 확인 → 일괄 이전 → 결과 리포트
- "휴면 유저 중 워크플로우 가진 사람 보여줘" → 위험 유저 목록

---

## Phase 4: 배포 (섹션 6 대응)

### 4-1. Windows `.exe` 빌드

**변경 대상:** `package.json` electron-builder 설정, GitHub Actions

**빌드 설정:**

- `package.json`에 Windows 타겟 추가: `"win": { "target": "nsis" }`
- 아이콘: `build/icon.ico` 추가 (기존 `icon.icns`에서 변환)
- 코드 서명: 초기에는 서명 없이 배포 (SmartScreen 경고 → 강의에서 "허용" 안내)

**GitHub Actions 워크플로우:** `.github/workflows/build-desktop.yml`

```yaml
on:
  push:
    tags: ["v*"]

jobs:
  build-mac:
    runs-on: macos-latest
    steps: electron-builder --mac dmg → artifact upload

  build-win:
    runs-on: windows-latest
    steps: electron-builder --win nsis → artifact upload

  release:
    needs: [build-mac, build-win]
    steps: GitHub Release 생성 → DMG + exe 첨부
```

**크로스 플랫폼 호환성:**

- `desktop/main.ts`: `path.join` 이미 사용 중 → 추가 변경 최소
- Shell 스크립트: Windows에서는 `setup.ps1`로 대체, 나머지 스크립트는 Git Bash 또는 대시보드 UI로 안내
- `_common.sh`의 `jq` 의존성: `setup.ps1`이 winget/choco로 설치 안내

### 4-2. 최종 산출물

| 산출물 | 위치 | 대상 |
|--------|------|------|
| macOS DMG | GitHub Releases | macOS GUI 사용자 |
| Windows exe | GitHub Releases | Windows GUI 사용자 |
| GitHub 리포 | `team-datapopcorn/n8n-admin` | 커스터마이징 사용자 |
| 클로드 스킬 | 리포 `.claude/skills/n8n/` | Claude Code 사용자 |
| `setup.sh` | 리포 루트 | macOS/Linux CLI 사용자 |
| `setup.ps1` | 리포 루트 | Windows CLI 사용자 |
| 명령어 치트시트 | 리포 내 | 전체 수강생 (부록 A-2) |

---

## 범위 외 (이번 설계에 포함하지 않음)

- n8n 고급 권한 관리 (Role/Permission API 통합)
- 멀티 테넌트 지원
- 모바일 앱
- 자동 업데이트 (Electron auto-updater) — 출시 후 고려
- 코드 서명 인증서 구매 — 출시 후 필요 시

---

_최종 수정일: 2026-03-26_
