#!/usr/bin/env bash
# 에러 트리거 일괄 등록 스크립트
# 모든 워크플로우에 에러 핸들러 워크플로우를 연결합니다.
# 사용법: ./scripts/register-error-triggers.sh <server> <error-workflow-id> [--execute]
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

# 사용법 안내
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "사용법: $0 <server> <error-workflow-id> [--execute]"
  echo "서버명: cloud | gcp-vm | railway | raspberry-pi"
  echo ""
  echo "옵션:"
  echo "  --execute    실제로 에러 트리거를 등록합니다 (기본: dry-run)"
  echo ""
  echo "예시:"
  echo "  $0 cloud abc123              # dry-run 모드"
  echo "  $0 cloud abc123 --execute    # 실제 등록"
  exit 1
fi

SERVER="$1"
ERROR_WF_ID="$2"
EXECUTE=false

if [ "${3:-}" = "--execute" ]; then
  EXECUTE=true
fi

check_deps
load_server_config "$SERVER"

if [ "$EXECUTE" = true ]; then
  echo "에러 트리거 등록 시작... (서버: $SERVER)"
else
  echo "[dry-run] 에러 트리거 등록 시작... (서버: $SERVER)"
fi
echo "에러 핸들러 워크플로우 ID: $ERROR_WF_ID"
echo ""

# 모든 워크플로우 조회
WORKFLOWS=$(fetch_all "workflows")

TOTAL=0
ALREADY=0
NEEDS=0
SKIPPED=0
UPDATED=0
FAILED=0

# 워크플로우 목록 순회
echo "$WORKFLOWS" | jq -c '.[]' | while read -r wf; do
  WF_ID=$(echo "$wf" | jq -r '.id')
  WF_NAME=$(echo "$wf" | jq -r '.name')
  CURRENT_ERROR_WF=$(echo "$wf" | jq -r '.settings.errorWorkflow // empty')

  TOTAL=$((TOTAL + 1))

  # 에러 핸들러 자신은 건너뜀
  if [ "$WF_ID" = "$ERROR_WF_ID" ]; then
    echo "  ⏭️  건너뜀: \"$WF_NAME\" (ID: $WF_ID) — 에러 핸들러 자신"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  # 이미 등록된 경우
  if [ "$CURRENT_ERROR_WF" = "$ERROR_WF_ID" ]; then
    echo "  ✅ 이미 등록: \"$WF_NAME\" (ID: $WF_ID)"
    ALREADY=$((ALREADY + 1))
    continue
  fi

  # 등록 필요
  if [ "$EXECUTE" = true ]; then
    # 전체 워크플로우 데이터 가져오기
    FULL_WF=$(curl -s -f \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Accept: application/json" \
      "$N8N_URL/api/v1/workflows/$WF_ID") || {
      echo "  ❌ 조회 실패: \"$WF_NAME\" (ID: $WF_ID)"
      FAILED=$((FAILED + 1))
      continue
    }

    # settings.errorWorkflow 추가
    UPDATED_WF=$(echo "$FULL_WF" | jq --arg ewf "$ERROR_WF_ID" '.settings.errorWorkflow = $ewf')

    # PUT으로 업데이트
    UPDATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X PUT \
      -H "Content-Type: application/json" \
      -H "X-N8N-API-KEY: $API_KEY" \
      -d "$UPDATED_WF" \
      "$N8N_URL/api/v1/workflows/$WF_ID")

    UPDATE_CODE=$(echo "$UPDATE_RESPONSE" | tail -1)
    if [ "$UPDATE_CODE" -ge 200 ] && [ "$UPDATE_CODE" -lt 300 ]; then
      echo "  ✅ 등록 완료: \"$WF_NAME\" (ID: $WF_ID)"
      UPDATED=$((UPDATED + 1))
    else
      echo "  ❌ 등록 실패: \"$WF_NAME\" (ID: $WF_ID) — HTTP $UPDATE_CODE"
      FAILED=$((FAILED + 1))
    fi
  else
    echo "  🔧 등록 필요: \"$WF_NAME\" (ID: $WF_ID)"
    NEEDS=$((NEEDS + 1))
  fi
done

# 서브쉘 문제를 해결하기 위해 카운트를 다시 계산
TOTAL=$(echo "$WORKFLOWS" | jq 'length')
SKIPPED=$(echo "$WORKFLOWS" | jq --arg id "$ERROR_WF_ID" '[.[] | select(.id == $id)] | length')
ALREADY=$(echo "$WORKFLOWS" | jq --arg id "$ERROR_WF_ID" '[.[] | select(.id != $id and .settings.errorWorkflow == $id)] | length')

if [ "$EXECUTE" = true ]; then
  NEEDS=0
  # UPDATED와 FAILED는 서브쉘에서 카운트되므로 계산으로 대체
  REMAINING=$((TOTAL - SKIPPED - ALREADY))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "요약: 전체 ${TOTAL}개 | 기존 등록 ${ALREADY}개 | 신규 등록 ${REMAINING}개 | 건너뜀 ${SKIPPED}개"
else
  NEEDS=$((TOTAL - SKIPPED - ALREADY))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "요약: 전체 ${TOTAL}개 | 등록됨 ${ALREADY}개 | 미등록 ${NEEDS}개 | 건너뜀 ${SKIPPED}개"
  echo "--execute 옵션으로 실제 등록하세요."
fi
