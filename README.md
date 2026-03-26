# n8n-admin

n8n 서버를 위한 관리 도구 키트. 워크플로우 백업·복원, 유저 관리, 크레덴셜 관리, 서버 이관 체크리스트, 웹 대시보드를 바로 사용할 수 있습니다.

![License](https://img.shields.io/github/license/datapopcorn/n8n-admin)
![Stars](https://img.shields.io/github/stars/datapopcorn/n8n-admin)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![pnpm](https://img.shields.io/badge/pnpm-required-orange)

---

## 미리보기

| 대시보드 | 워크플로우 |
|----------|-----------|
| ![대시보드](docs/screenshots/02-dashboard.png) | ![워크플로우](docs/screenshots/03-workflows.png) |

| 유저 관리 | 크레덴셜 |
|-----------|---------|
| ![유저](docs/screenshots/04-users.png) | ![크레덴셜](docs/screenshots/05-credentials.png) |

---

## Desktop App (macOS)

개발 도구 설치 없이 n8n 서버를 관리하고 싶다면 데스크톱 앱을 사용하세요.

### 설치

1. [최신 릴리즈](https://github.com/team-datapopcorn/n8n-admin/releases)에서 `n8n.Admin-1.0.0-arm64.dmg` 다운로드
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

---

## 빠른 시작 — Scripts (5분)

n8n 서버 URL과 API 키만 있으면 바로 시작할 수 있습니다.

```bash
# 1. 레포 clone (또는 우측 상단 "Use this template" 버튼 사용)
git clone https://github.com/datapopcorn/n8n-admin.git
cd n8n-admin

# 2. 환경 설정
cp .env.example .env
# .env 파일을 열어 SERVER_URL과 SERVER_API_KEY 입력

# 3. 의존성 설치 (macOS)
brew install jq
# Ubuntu/Debian: sudo apt install jq

# 4. 워크플로우 백업
./scripts/export.sh server1

# 5. 유저 목록 조회
./scripts/list-users.sh server1
```

---

## 포함 기능

| 도구 | 기능 |
|------|------|
| **Desktop App** | macOS 앱으로 서버 상태 모니터링, 워크플로우·유저·크레덴셜 관리 |
| **Shell Scripts** | 워크플로우 export/import, 유저 관리, 크레덴셜 관리, 서버 이관 |
| **GCP VM 제어** | VM 시작/중지/재시작/리사이즈 (선택) |

---

## 서버 추가

`.env`에 서버 항목을 추가하고 `scripts/_common.sh`에도 case를 추가합니다.

```bash
# .env에 추가
SERVER2_NAME=Backup Server
SERVER2_URL=https://your-second-n8n.com
SERVER2_API_KEY=your_second_api_key
```

```bash
# scripts/_common.sh의 case 블록에 추가
server2) N8N_URL="${SERVER2_URL:-}"; API_KEY="${SERVER2_API_KEY:-}" ;;
```

> ⚠️ 서버 번호는 연속해야 합니다 (server2 없이 server3만 있으면 무시됩니다).

---

## Scripts 전체 목록

| 스크립트 | 설명 | 사용법 |
|----------|------|--------|
| `export.sh` | 워크플로우 JSON 백업 | `./scripts/export.sh server1` |
| `import.sh` | 워크플로우 복원/배포 | `./scripts/import.sh server1 server1/workflows/My_Workflow.json` |
| `list-users.sh` | 유저 목록 / 휴면 탐지 | `./scripts/list-users.sh server1 --dormant 90` |
| `cleanup-users.sh` | 휴면 유저 삭제 | `./scripts/cleanup-users.sh server1 --dormant 180 --dry-run` |
| `invite-users.sh` | 유저 초대 | `./scripts/invite-users.sh server1 user@example.com` |
| `list-credentials.sh` | 크레덴셜 목록 | `./scripts/list-credentials.sh server1` |
| `delete-credential.sh` | 크레덴셜 삭제 | `./scripts/delete-credential.sh server1 abc123` |
| `cleanup-workflows.sh` | 중복/불필요 워크플로우 정리 | `./scripts/cleanup-workflows.sh server1 --execute` |
| `migration-checklist.sh` | 서버 이관 체크리스트 | `./scripts/migration-checklist.sh server1 server2` |
| `gcp-vm.sh` | GCP VM 제어 | `./scripts/gcp-vm.sh status` |

---

## GCP VM 관리 (선택)

GCP VM에 n8n을 올린 경우 VM을 직접 제어할 수 있습니다.
설정 가이드: [docs/gcp-setup.md](docs/gcp-setup.md)

---

## Claude Code — AI로 n8n 관리하기

이 레포에는 [Claude Code](https://claude.ai/claude-code)용 **n8n 스킬**이 포함되어 있습니다. 자연어로 워크플로우를 만들고, 실패를 디버깅하고, 교육 콘텐츠를 생성할 수 있습니다.

### 사전 준비

1. **Claude Code** 설치 ([공식 문서](https://docs.anthropic.com/en/docs/claude-code/overview))
2. **n8n MCP 서버** 연결 — Claude Code 설정에 n8n-cloud MCP 서버를 추가합니다:

```json
// .claude/settings.json 또는 ~/.claude/settings.json
{
  "mcpServers": {
    "n8n-cloud": {
      "type": "url",
      "url": "https://your-n8n-mcp-endpoint"
    }
  }
}
```

> n8n MCP 서버 설정 방법은 [n8n 공식 문서](https://docs.n8n.io)를 참고하세요.

### 스킬 구조

```
.claude/skills/n8n/
├── SKILL.md                          # 메인 스킬 (모듈 라우팅, 공통 규칙, 도구 목록)
└── references/
    ├── workflow-builder.md           # 워크플로우 생성/수정/분석
    ├── ops-manager.md                # 모니터링/디버깅/실행 관리
    └── teaching-guide.md             # 튜토리얼/강의자료/실습 생성
```

### 사용법

이 레포 디렉토리에서 Claude Code를 실행하면 n8n 스킬이 자동으로 로드됩니다.

```bash
cd n8n-admin
claude
```

#### 워크플로우 생성

자연어로 원하는 워크플로우를 설명하면 Claude가 6단계 프로세스로 생성합니다.

```
> 매일 아침 9시에 기상청 API에서 날씨를 가져와서 Slack에 보내줘
> GitHub 이슈가 생기면 Notion 데이터베이스에 자동 추가하는 워크플로우 만들어
> 웹훅으로 주문 데이터를 받아서 Google Sheets에 기록해줘
```

**내부 동작:**
1. 요청 분석 → 필요한 노드 식별
2. `search_nodes` → `get_node`로 노드 스펙 확인
3. 워크플로우 JSON 구성 (노드, 연결, 설정)
4. `validate_workflow`로 사전 검증
5. `n8n_create_workflow`로 생성 + `n8n_test_workflow`로 테스트
6. 결과 보고 (워크플로우 ID, 노드 구성, 테스트 결과)

#### 운영 모니터링 & 디버깅

실행 현황을 확인하거나 실패 원인을 분석합니다.

```
> n8n 워크플로우 전체 현황 보여줘
> 최근 실패한 워크플로우 원인 분석해줘
> 워크플로우 ID:123이 자꾸 실패하는데 왜 그런지 알아봐줘
```

**디버깅 프로세스:**
1. `n8n_executions`로 실패 이력 조회
2. 에러 메시지와 실패 노드 식별
3. 원인 분류 (연결/데이터/로직/리소스 에러)
4. `n8n_autofix_workflow`로 자동 수정 시도
5. 자동 수정 실패 시 수동 수정안 제시
6. 수정 실패 시 `n8n_workflow_versions`로 롤백

#### 기존 워크플로우 분석 & 개선

이미 만들어진 워크플로우를 점검하고 개선합니다.

```
> 워크플로우 ID:456 분석해줘
> 에러 핸들링이 없는 워크플로우 찾아서 추가해줘
> 이 워크플로우 성능 개선할 수 있어?
```

**점검 항목:** 에러 핸들링 누락, 중복 노드, 비효율적 데이터 처리, 하드코딩된 값

#### 교육 콘텐츠 생성

n8n 튜토리얼, 실습 자료, 강의 슬라이드를 만듭니다.

```
> HTTP Request 노드 심화 튜토리얼 만들어줘
> 에러 핸들링 패턴 실습 워크플로우 만들어줘 (실제 n8n에 생성)
> 웹훅 활용법 강의 슬라이드 만들어줘
```

**3가지 출력 형태:**
| 형태 | 설명 |
|------|------|
| 마크다운 튜토리얼 | 개요→핵심개념→단계별구현→응용패턴 구조의 문서 |
| 실습형 | 실제 n8n에 워크플로우를 점진적으로 생성하며 학습 |
| 강의 슬라이드 | 본문 + 발표자 노트 형식의 슬라이드 구성 |

### MCP 도구 전체 목록 (21개)

<details>
<summary>펼쳐보기</summary>

| 카테고리 | 도구 | 용도 |
|----------|------|------|
| **생명주기** | `n8n_health_check` | 인스턴스 상태 확인 |
| | `n8n_create_workflow` | 워크플로우 생성 |
| | `n8n_get_workflow` | 워크플로우 상세 조회 |
| | `n8n_list_workflows` | 전체 목록 조회 |
| | `n8n_update_full_workflow` | 전체 업데이트 |
| | `n8n_update_partial_workflow` | 부분 패치 |
| | `n8n_delete_workflow` | 삭제 |
| | `n8n_workflow_versions` | 버전 이력/롤백 |
| **검증/테스트** | `validate_workflow` | JSON 사전 검증 |
| | `n8n_validate_workflow` | ID 기반 사후 검증 |
| | `validate_node` | 개별 노드 검증 |
| | `n8n_autofix_workflow` | 자동 수정 |
| | `n8n_test_workflow` | 테스트 실행 |
| **실행/데이터** | `n8n_executions` | 실행 이력 조회 |
| | `n8n_manage_datatable` | 데이터 테이블 관리 |
| **노드/템플릿** | `search_nodes` | 노드 검색 |
| | `get_node` | 노드 상세 정보 |
| | `search_templates` | 템플릿 검색 |
| | `get_template` | 템플릿 상세 정보 |
| | `n8n_deploy_template` | 템플릿 배포 |
| **참조** | `tools_documentation` | 도구 문서 조회 |

</details>

### 안전 원칙

- 삭제, 전체 업데이트 등 **파괴적 작업은 항상 사용자 확인 후** 실행
- 수정 전 `n8n_workflow_versions`로 현재 버전 확인 → 실패 시 즉시 롤백
- `n8n_test_workflow`는 **webhook/form/chat 트리거만** 지원 (스케줄 트리거는 n8n UI에서 수동 테스트)

---

## 요구사항

- **Desktop App:** macOS (Apple Silicon)
- **Shell Scripts:** bash, jq
- **Admin 대시보드 (직접 빌드):** Node.js 20+, pnpm
- **Claude Code 스킬:** [Claude Code](https://claude.ai/claude-code) + n8n MCP 서버 연결
