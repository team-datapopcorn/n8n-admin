#!/bin/bash
# n8n 워크플로우 Import 스크립트
# 사용법: ./scripts/import.sh <서버명> <워크플로우_파일.json>
# 예시:   ./scripts/import.sh server1 server1/workflows/My_Workflow_abc123.json
#         ./scripts/import.sh server2 server2/workflows/My_Workflow_def456.json

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

# 서버명, 파일 인자 확인
SERVER="${1:-}"
WF_FILE="${2:-}"

if [ -z "$SERVER" ] || [ -z "$WF_FILE" ]; then
  echo "사용법: $0 <서버명> <워크플로우_파일.json>"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

if [ ! -f "$WF_FILE" ]; then
  echo "오류: 파일을 찾을 수 없습니다: $WF_FILE"
  exit 1
fi

# 서버 설정 로드
load_server_config "$SERVER"

echo "[$SERVER] 워크플로우 import 시작..."
echo "서버: $N8N_URL"
echo "파일: $WF_FILE"
echo ""

# 쓰기 가능한 필드만 남겨서 import (새 워크플로우로 생성, n8n 2.x/3.x strict 검증 대응)
WF_JSON=$(jq "$N8N_WRITABLE_JQ" "$WF_FILE")

RESPONSE=$(printf '%s' "$WF_JSON" | curl -s -w "\n%{http_code}" \
  -X POST \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @- \
  "$N8N_URL/api/v1/workflows")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  NEW_ID=$(echo "$BODY" | jq -r '.id')
  NEW_NAME=$(echo "$BODY" | jq -r '.name')
  echo "완료: '$NEW_NAME' 워크플로우가 생성되었습니다. (ID: $NEW_ID)"
else
  echo "오류: import 실패 (HTTP $HTTP_CODE)"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
  exit 1
fi
