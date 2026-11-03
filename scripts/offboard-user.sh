#!/bin/bash
# 퇴사자 오프보딩 스크립트
# 사용법: ./scripts/offboard-user.sh <서버명> <이메일> [--execute]
# 예시:   ./scripts/offboard-user.sh cloud user@example.com             # dry-run (확인만)
#         ./scripts/offboard-user.sh cloud user@example.com --execute    # 실제 삭제 실행

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
EMAIL="${2:-}"
EXECUTE=false

shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ] || [ -z "$EMAIL" ]; then
  echo "사용법: $0 <서버명> <이메일> [--execute]"
  echo ""
  echo "예시:"
  echo "  $0 cloud user@example.com             # dry-run (확인만)"
  echo "  $0 cloud user@example.com --execute    # 실제 삭제 실행"
  echo ""
  echo "서버명: cloud | gcp-vm | railway | raspberry-pi"
  exit 1
fi

load_server_config "$SERVER"

MODE="dry-run"
if $EXECUTE; then
  MODE="execute"
fi

echo "[$MODE] 퇴사 처리 시작... (서버: $SERVER)"
echo ""

# ─── 1. 사용자 조회 ────────────────────────────────────
USERS_DATA=$(fetch_all "users")

USER_INFO=$(echo "$USERS_DATA" | jq --arg email "$EMAIL" '[.[] | select(.email == $email)] | .[0] // empty')

if [ -z "$USER_INFO" ] || [ "$USER_INFO" = "null" ]; then
  echo "오류: '$EMAIL' 사용자를 찾을 수 없습니다."
  exit 1
fi

USER_ID=$(echo "$USER_INFO" | jq -r '.id')
USER_EMAIL=$(echo "$USER_INFO" | jq -r '.email')
USER_FIRST=$(echo "$USER_INFO" | jq -r '.firstName // ""')
USER_LAST=$(echo "$USER_INFO" | jq -r '.lastName // ""')
USER_NAME="${USER_FIRST} ${USER_LAST}"
USER_NAME=$(echo "$USER_NAME" | xargs)  # trim whitespace
USER_ROLE=$(echo "$USER_INFO" | jq -r '.role // .globalRole // "unknown"')
USER_LAST_ACTIVE=$(echo "$USER_INFO" | jq -r '.lastActiveAt // "없음"')

# owner/admin 보호
if [ "$USER_ROLE" = "global:owner" ] || [ "$USER_ROLE" = "global:admin" ]; then
  echo "오류: owner 또는 admin 계정은 삭제할 수 없습니다."
  echo "  이메일: $USER_EMAIL"
  echo "  역할: $USER_ROLE"
  exit 1
fi

echo "대상 사용자:"
echo "  이메일: $USER_EMAIL"
echo "  이름: ${USER_NAME:-없음}"
echo "  역할: $USER_ROLE"
echo "  마지막 활동: $USER_LAST_ACTIVE"
echo ""

# ─── 2. 워크플로우 백업 ─────────────────────────────────
BACKUP_DATE=$(date +%Y-%m-%d)
BACKUP_DIR="$REPO_ROOT/backups/$SERVER/${USER_EMAIL}_${BACKUP_DATE}"

WORKFLOWS_DATA=$(fetch_all "workflows")
WF_COUNT=$(echo "$WORKFLOWS_DATA" | jq 'length')

if $EXECUTE; then
  mkdir -p "$BACKUP_DIR"

  echo "$WORKFLOWS_DATA" | jq -c '.[]' | while read -r WF; do
    WF_ID=$(echo "$WF" | jq -r '.id')
    WF_NAME=$(echo "$WF" | jq -r '.name' | tr ' /' '_' | tr -cd '[:alnum:]_-')
    FILENAME="${WF_NAME}_${WF_ID}.json"
    echo "$WF" | jq '.' > "$BACKUP_DIR/$FILENAME"
  done

  echo "워크플로우 백업:"
  echo "  → $BACKUP_DIR 에 ${WF_COUNT}개 워크플로우 백업 완료"
else
  echo "워크플로우 백업:"
  echo "  → $BACKUP_DIR 에 ${WF_COUNT}개 워크플로우 백업 예정"
fi
echo ""

# ─── 3. 사용자 삭제 ─────────────────────────────────────
if $EXECUTE; then
  echo "조치 진행:"

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "X-N8N-API-KEY: $API_KEY" \
    "$N8N_URL/api/v1/users/$USER_ID")

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo "  1. 사용자 계정 삭제 완료: $USER_EMAIL"
  else
    echo "  1. 사용자 계정 삭제 실패 (HTTP $HTTP_CODE): $USER_EMAIL"
  fi

  echo "  2. 워크플로우는 보존됨 (관리자가 수동으로 인계 필요)"
  echo ""
  echo "퇴사 처리 완료."
else
  echo "조치 항목:"
  echo "  1. 사용자 계정 삭제"
  echo "  2. 워크플로우는 보존됨 (관리자가 수동으로 인계 필요)"
  echo ""
  echo "--execute 옵션으로 실제 삭제를 진행하세요."
fi
