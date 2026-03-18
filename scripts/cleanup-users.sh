#!/bin/bash
# 휴면 유저 정리 스크립트
# 사용법: ./scripts/cleanup-users.sh <서버명> --dormant <일수> [--dry-run]
# 예시:   ./scripts/cleanup-users.sh railway --dormant 180          # 180일 미접속 유저 삭제
#         ./scripts/cleanup-users.sh railway --dormant 180 --dry-run  # 삭제 없이 목록만 확인

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
DORMANT_DAYS=""
DRY_RUN=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dormant)  DORMANT_DAYS="$2"; shift 2 ;;
    --dry-run)  DRY_RUN=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ] || [ -z "$DORMANT_DAYS" ]; then
  echo "사용법: $0 <서버명> --dormant <일수> [--dry-run]"
  echo ""
  echo "예시:"
  echo "  $0 railway --dormant 180 --dry-run   # 먼저 목록 확인"
  echo "  $0 railway --dormant 180             # 실제 삭제"
  exit 1
fi

load_server_config "$SERVER"

echo "[$SERVER] 휴면 유저 탐지 중 (${DORMANT_DAYS}일 이상 미접속)..."
echo ""

DATA=$(fetch_all "users")
NOW_TS=$(date +%s)

# 휴면 유저 필터링 (관리자 제외, 미접속 또는 오래된 접속)
DORMANT=$(echo "$DATA" | jq --argjson now "$NOW_TS" --argjson days "$DORMANT_DAYS" '[
  .[] |
  select(.role != "global:owner") |
  select(.role != "global:admin") |
  select(
    .lastActiveAt == null or
    (($now - (.lastActiveAt | sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)) / 86400) >= $days
  ) |
  {
    id,
    email,
    role,
    lastActiveAt,
    daysSinceActive: (
      if .lastActiveAt != null then
        (($now - (.lastActiveAt | sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)) / 86400 | floor)
      else
        null
      end
    )
  }
]')

COUNT=$(echo "$DORMANT" | jq 'length')

if [ "$COUNT" -eq 0 ]; then
  echo "${DORMANT_DAYS}일 이상 미접속 유저가 없습니다."
  exit 0
fi

echo "── 휴면 유저 목록 (${COUNT}명) ─────────────────"
echo "$DORMANT" | jq -r '.[] | "  \(.email)  (\(.daysSinceActive // "접속 기록 없음")일 전)"'
echo ""

if $DRY_RUN; then
  echo "[dry-run] 실제 삭제는 수행하지 않습니다."
  echo "실제 삭제하려면 --dry-run 옵션을 제거하세요."
  exit 0
fi

echo "주의: owner/admin 계정은 삭제에서 제외됩니다."
read -p "${COUNT}명의 휴면 유저를 삭제하시겠습니까? (yes 입력 시 삭제): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "취소되었습니다."
  exit 0
fi

echo ""
DELETED=0
FAILED=0

echo "$DORMANT" | jq -r '.[].id' | while read -r USER_ID; do
  EMAIL=$(echo "$DORMANT" | jq -r --arg id "$USER_ID" '.[] | select(.id == $id) | .email')

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "X-N8N-API-KEY: $API_KEY" \
    "$N8N_URL/api/v1/users/$USER_ID")

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo "  삭제됨: $EMAIL"
    DELETED=$((DELETED + 1))
  else
    echo "  실패 (HTTP $HTTP_CODE): $EMAIL"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "완료 - 삭제: ${DELETED}명 / 실패: ${FAILED}명"
