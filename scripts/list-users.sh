#!/bin/bash
# 유저 목록 조회 및 저장 스크립트
# 사용법: ./scripts/list-users.sh <서버명> [--dormant <일수>]
# 예시:   ./scripts/list-users.sh railway             # 전체 유저 목록
#         ./scripts/list-users.sh railway --dormant 90  # 90일 이상 미접속 유저만

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
DORMANT_DAYS=""

# 인자 파싱
shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dormant) DORMANT_DAYS="$2"; shift 2 ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명> [--dormant <일수>]"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

load_server_config "$SERVER"

OUTPUT_DIR="$REPO_ROOT/$SERVER/users"
OUTPUT_FILE="$OUTPUT_DIR/users.json"
mkdir -p "$OUTPUT_DIR"

echo "[$SERVER] 유저 목록 조회 중..."

DATA=$(fetch_all "users")
NOW_TS=$(date +%s)

# 유저 정보 정리 + 미접속 일수 계산
# lastActiveAt/role은 서버 버전에 따라 없을 수 있음 (n8n Cloud 등)
USERS=$(echo "$DATA" | jq --argjson now "$NOW_TS" '[.[] | {
  id,
  email,
  firstName,
  lastName,
  role: (.role // .globalRole // null),
  isPending,
  createdAt,
  lastActiveAt: (.lastActiveAt // null),
  daysSinceActive: (
    if (.lastActiveAt // null) != null then
      (($now - (.lastActiveAt | sub("\\.[0-9]+Z$"; "Z") | strptime("%Y-%m-%dT%H:%M:%SZ") | mktime)) / 86400 | floor)
    else
      null
    end
  )
}] | sort_by(.daysSinceActive // 99999)')

echo "$USERS" | jq '.' > "$OUTPUT_FILE"
COUNT=$(echo "$USERS" | jq 'length')

if [ -n "$DORMANT_DAYS" ]; then
  # 휴면 유저만 필터링
  DORMANT=$(echo "$USERS" | jq --argjson days "$DORMANT_DAYS" '[.[] | select((.daysSinceActive // 99999) >= $days)]')
  DORMANT_COUNT=$(echo "$DORMANT" | jq 'length')

  echo ""
  echo "── 전체 유저: ${COUNT}명 ────────────────────"
  echo "── ${DORMANT_DAYS}일 이상 미접속 (휴면): ${DORMANT_COUNT}명 ──────"
  echo ""
  echo "$DORMANT" | jq -r '.[] | "  \(.email)  (마지막 접속: \(.lastActiveAt // "없음"), \(.daysSinceActive // "?")일 전)"'
  echo ""
  echo "휴면 유저를 삭제하려면:"
  echo "  ./scripts/cleanup-users.sh $SERVER --dormant $DORMANT_DAYS"
else
  echo ""
  echo "── 전체 유저: ${COUNT}명 ────────────────────"
  echo ""
  echo "$USERS" | jq -r '.[] | "  [\(.role // "-")] \(.email)  \(if .isPending then "(초대 대기중)" elif .daysSinceActive != null then "(\(.daysSinceActive)일 전 접속)" else "(접속 기록 없음)" end)"'
fi

echo ""
echo "파일 저장: $OUTPUT_FILE"
