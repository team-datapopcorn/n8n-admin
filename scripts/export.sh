#!/bin/bash
# n8n 워크플로우 Export 스크립트
# 사용법: ./scripts/export.sh <서버명>
# 예시:   ./scripts/export.sh server1
#         ./scripts/export.sh server2
#         ./scripts/export.sh server3

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

# 의존성 확인
check_deps

# 서버명 인자 확인
SERVER="${1:-}"
if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명>"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

# 서버 설정 로드
load_server_config "$SERVER"

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/$SERVER/workflows"
mkdir -p "$OUTPUT_DIR"

echo "[$SERVER] 워크플로우 export 시작..."
echo "서버: $N8N_URL"
echo "저장 경로: $OUTPUT_DIR"
echo ""

# 페이지네이션으로 전체 워크플로우 수집
CURSOR=""
TOTAL=0

while true; do
  if [ -z "$CURSOR" ]; then
    RESPONSE=$(curl -s -f \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Accept: application/json" \
      "$N8N_URL/api/v1/workflows?limit=100")
  else
    RESPONSE=$(curl -s -f \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Accept: application/json" \
      "$N8N_URL/api/v1/workflows?limit=100&cursor=$CURSOR")
  fi

  if [ $? -ne 0 ]; then
    echo "오류: API 호출 실패. URL과 API 키를 확인하세요."
    exit 1
  fi

  # 워크플로우 목록 처리
  COUNT=$(echo "$RESPONSE" | jq '.data | length')
  if [ "$COUNT" -eq 0 ]; then
    break
  fi

  echo "$RESPONSE" | jq -c '.data[]' | while read -r WF; do
    ID=$(echo "$WF" | jq -r '.id')
    NAME=$(echo "$WF" | jq -r '.name' | tr ' /' '_' | tr -cd '[:alnum:]_-')
    FILENAME="${NAME}_${ID}.json"

    echo "$WF" | jq '.' > "$OUTPUT_DIR/$FILENAME"
    echo "  저장: $FILENAME"
  done

  TOTAL=$((TOTAL + COUNT))

  # 다음 페이지 확인
  NEXT_CURSOR=$(echo "$RESPONSE" | jq -r '.nextCursor // empty')
  if [ -z "$NEXT_CURSOR" ]; then
    break
  fi
  CURSOR="$NEXT_CURSOR"
done

echo ""
echo "완료: $TOTAL개 워크플로우를 $OUTPUT_DIR 에 저장했습니다."
