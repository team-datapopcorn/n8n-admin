#!/bin/bash
# 크레덴셜 삭제 스크립트
# 사용법: ./scripts/delete-credential.sh <서버명> <크레덴셜_ID>
# 예시:   ./scripts/delete-credential.sh cloud abc123
#
# 크레덴셜 ID는 list-credentials.sh 실행 후 credentials.json 파일에서 확인하세요.

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
CRED_ID="${2:-}"

if [ -z "$SERVER" ] || [ -z "$CRED_ID" ]; then
  echo "사용법: $0 <서버명> <크레덴셜_ID>"
  echo ""
  echo "크레덴셜 ID 확인 방법:"
  echo "  ./scripts/list-credentials.sh <서버명>"
  echo "  cat <서버명>/credentials/credentials.json | jq '.[] | {id, name, type}'"
  exit 1
fi

load_server_config "$SERVER"

# 삭제 전 크레덴셜 정보 확인
echo "[$SERVER] 크레덴셜 정보 확인 중..."
CRED_INFO=$(curl -s -f \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/credentials/$CRED_ID" 2>/dev/null) || {
  echo "오류: 크레덴셜 ID '$CRED_ID'를 찾을 수 없습니다."
  exit 1
}

CRED_NAME=$(echo "$CRED_INFO" | jq -r '.name')
CRED_TYPE=$(echo "$CRED_INFO" | jq -r '.type')

echo ""
echo "삭제 대상:"
echo "  이름: $CRED_NAME"
echo "  타입: $CRED_TYPE"
echo "  ID:   $CRED_ID"
echo ""
read -p "정말 삭제하시겠습니까? (yes 입력 시 삭제): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "취소되었습니다."
  exit 0
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X DELETE \
  -H "X-N8N-API-KEY: $API_KEY" \
  "$N8N_URL/api/v1/credentials/$CRED_ID")

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
  echo "완료: '$CRED_NAME' 크레덴셜이 삭제되었습니다."
else
  echo "오류: 삭제 실패 (HTTP $HTTP_CODE)"
  exit 1
fi
