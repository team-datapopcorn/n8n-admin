#!/bin/bash
# 에러 트리거가 없는 활성 워크플로우에 일괄 등록
# 사용법: ./scripts/add-error-triggers.sh <server> [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"
check_deps

SERVER="${1:?사용법: $0 <server> [--dry-run]}"
shift
load_server_config "$SERVER"

DRY_RUN=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run) DRY_RUN=true; shift ;;
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
MISSING=$(echo "$ALL_WORKFLOWS" | jq '[.[] | select(.active == true) | select((.nodes // []) | map(.type // "") | index("n8n-nodes-base.errorTrigger") | not)]')
MISSING_COUNT=$(echo "$MISSING" | jq 'length')

ACTIVE_COUNT=$(echo "$ALL_WORKFLOWS" | jq '[.[] | select(.active == true)] | length')
HAS_COUNT=$((ACTIVE_COUNT - MISSING_COUNT))

echo "활성 워크플로우: ${ACTIVE_COUNT}개"
echo "  에러 트리거 있음: ${HAS_COUNT}개"
echo "  에러 트리거 없음: ${MISSING_COUNT}개"
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
  WF_DETAIL=$(curl -s -f \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL/api/v1/workflows/$ID") || { echo "조회 실패"; FAILED=$((FAILED + 1)); continue; }

  # Error Trigger 노드 추가
  UPDATED=$(echo "$WF_DETAIL" | jq '
    .nodes += [{
      "parameters": {},
      "type": "n8n-nodes-base.errorTrigger",
      "typeVersion": 1,
      "position": [-200, 0],
      "id": "error-trigger-auto",
      "name": "Error Trigger"
    }]
  ')

  # 워크플로우 업데이트
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$UPDATED" \
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
echo "기존 등록: ${HAS_COUNT}개"
