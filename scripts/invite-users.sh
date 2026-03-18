#!/bin/bash
# 유저 초대 스크립트
# 사용법: ./scripts/invite-users.sh <서버명> <이메일> [<이메일2> ...]
#         ./scripts/invite-users.sh <서버명> --file <이메일목록.txt>
#
# 예시:
#   ./scripts/invite-users.sh railway user@example.com
#   ./scripts/invite-users.sh railway user1@example.com user2@example.com
#   ./scripts/invite-users.sh railway --file emails.txt
#
# 이메일 목록 파일 형식 (한 줄에 이메일 하나):
#   user1@example.com
#   user2@example.com

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
shift || true

if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명> <이메일> [<이메일2> ...]"
  echo "         $0 <서버명> --file <이메일목록.txt>"
  exit 1
fi

load_server_config "$SERVER"

# 이메일 목록 수집
EMAILS=()
if [ "${1:-}" = "--file" ]; then
  FILE="${2:-}"
  if [ ! -f "$FILE" ]; then
    echo "오류: 파일을 찾을 수 없습니다: $FILE"
    exit 1
  fi
  while IFS= read -r line; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    EMAILS+=("$line")
  done < "$FILE"
else
  EMAILS=("$@")
fi

if [ ${#EMAILS[@]} -eq 0 ]; then
  echo "오류: 초대할 이메일 주소가 없습니다."
  exit 1
fi

echo "[$SERVER] ${#EMAILS[@]}명 초대 시작..."
echo ""

SUCCESS=0
FAILED=0

for EMAIL in "${EMAILS[@]}"; do
  PAYLOAD=$(jq -n --arg email "$EMAIL" '[{"email": $email, "role": "global:member"}]')

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$N8N_URL/api/v1/users")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -n -1)

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo "  초대 완료: $EMAIL"
    SUCCESS=$((SUCCESS + 1))
  else
    MSG=$(echo "$BODY" | jq -r '.message // .error // "알 수 없는 오류"' 2>/dev/null)
    echo "  실패: $EMAIL  ($MSG)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "완료 - 성공: ${SUCCESS}명 / 실패: ${FAILED}명"
