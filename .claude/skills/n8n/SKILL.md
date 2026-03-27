---
name: n8n
description: "n8n 워크플로우 자동화 스킬. n8n-cloud MCP 도구를 활용하여 워크플로우 생성/수정/분석, 운영 모니터링/디버깅, 교육 콘텐츠 생성을 지원한다. 'n8n', 'n8n 워크플로우', 'n8n 만들어', 'n8n 자동화', 'n8n 디버깅', 'n8n 강의', '워크플로우 만들어' 키워드에 트리거. '자동화' 단독 키워드는 n8n 컨텍스트가 있을 때만 트리거."
---

# n8n 워크플로우 자동화 스킬

n8n-cloud MCP 서버의 21개 도구를 활용하여 워크플로우를 생성하고, 운영하고, 교육 콘텐츠를 만드는 스킬.

## 모듈 라우팅

사용자 요청을 분석하여 적절한 모듈을 로드한다.

| 사용자 의도 | 로드할 모듈 |
|---|---|
| 워크플로우 생성/수정/분석/개선 | `references/workflow-builder.md` |
| 실행 확인/실패 원인/상태 점검 | `references/ops-manager.md` |
| 튜토리얼/강의자료/실습 생성 | `references/teaching-guide.md` |
| 복합 요청 | 해당 모듈 복수 로드 (우선순위: ops → builder → teaching) |

의도가 불분명하면 사용자에게 확인한다.

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

## 에러 대응 가이드

MCP 도구 호출 실패 시 아래 안내를 사용자에게 제공한다:

| 에러 상황 | 안내 |
|----------|------|
| MCP 연결 실패 / 도구 미발견 | "n8n MCP 서버가 연결되지 않았습니다. `./setup.sh`를 실행하거나 Settings 페이지에서 Claude Code 연결 가이드를 확인해주세요." |
| HTTP 401 / 인증 실패 | "API 키가 만료되었거나 잘못되었습니다. n8n → Settings → API에서 확인해주세요." |
| HTTP 403 / 권한 부족 | "이 작업에는 Owner 권한이 필요합니다. n8n 관리자에게 문의해주세요." |
| 노드 미발견 (search_nodes 결과 없음) | "이 노드는 커뮤니티 노드일 수 있습니다. n8n → Settings → Community Nodes에서 먼저 설치해주세요." |
| n8n_test_workflow 실패 (지원 안 됨) | "이 트리거 타입은 테스트를 지원하지 않습니다. n8n UI에서 수동으로 테스트해주세요." |

## 공통 규칙

### 시작 전 항상 실행
- `n8n_health_check`로 n8n 인스턴스 상태 확인

### 노드 검색 패턴
```
search_nodes(쿼리) → get_node(노드타입) → validate_node(노드 설정 검증)
```

### 템플릿 활용 패턴
```
search_templates(쿼리) → get_template(ID) → n8n_deploy_template(배포)
```

### 워크플로우 생성 패턴
```
validate_workflow(JSON 사전 검증) → n8n_create_workflow(생성) → n8n_test_workflow(테스트)
```

### 워크플로우 수정 패턴
- 부분 수정: `n8n_update_partial_workflow` (노드 추가/삭제/수정, 연결 변경 등)
- 전체 교체: `n8n_update_full_workflow` (구조 대폭 변경 시)
- 수정 전 `n8n_get_workflow`로 현재 상태 반드시 확인

### 검증 도구 구분
- `validate_workflow`: JSON 페이로드 사전 검증 (생성 전)
- `n8n_validate_workflow`: ID 기반 사후 검증 (생성/수정 후)
- `validate_node`: 개별 노드 설정 검증

### 테스트 제약사항
- `n8n_test_workflow`는 webhook/form/chat 트리거만 지원
- 스케줄/크론 기반 워크플로우는 사용자에게 n8n UI에서 수동 테스트 안내

### 안전 원칙
- 파괴적 작업(삭제, 전체 업데이트)은 반드시 사용자 확인 후 실행
- 수정 전 `n8n_workflow_versions`로 현재 버전 확인, 실패 시 rollback 안내
- 도구 사용법이 불확실하면 `tools_documentation`으로 확인

## n8n-cloud MCP 도구 목록 (21개)

### 워크플로우 생명주기
| 도구 | 용도 |
|---|---|
| `n8n_health_check` | 인스턴스 상태 확인 |
| `n8n_create_workflow` | 새 워크플로우 생성 |
| `n8n_get_workflow` | 워크플로우 상세 조회 |
| `n8n_list_workflows` | 전체 워크플로우 목록 |
| `n8n_update_full_workflow` | 워크플로우 전체 업데이트 |
| `n8n_update_partial_workflow` | 워크플로우 부분 패치 |
| `n8n_delete_workflow` | 워크플로우 삭제 |
| `n8n_workflow_versions` | 버전 이력 조회/롤백 |

### 검증 및 테스트
| 도구 | 용도 |
|---|---|
| `validate_workflow` | JSON 사전 검증 |
| `n8n_validate_workflow` | ID 기반 사후 검증 |
| `validate_node` | 개별 노드 검증 |
| `n8n_autofix_workflow` | 자동 수정 |
| `n8n_test_workflow` | 테스트 실행 (webhook/form/chat만) |

### 실행 및 데이터
| 도구 | 용도 |
|---|---|
| `n8n_executions` | 실행 이력 조회 |
| `n8n_manage_datatable` | 데이터 테이블 관리 |

### 노드 및 템플릿
| 도구 | 용도 |
|---|---|
| `search_nodes` | 노드 검색 |
| `get_node` | 노드 상세 정보 |
| `search_templates` | 템플릿 검색 |
| `get_template` | 템플릿 상세 정보 |
| `n8n_deploy_template` | 템플릿 배포 |

### 참조
| 도구 | 용도 |
|---|---|
| `tools_documentation` | 도구 문서 조회 |

## 출력 언어

모든 출력은 한국어로 작성한다. 워크플로우 이름, 노드 설명 등도 한국어로 지정한다. 단, 노드 타입명이나 기술 용어는 원어 그대로 사용한다.
