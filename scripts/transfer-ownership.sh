#!/bin/bash
# 퇴사자/담당자 변경 시 워크플로우 + 크레덴셜 소유권 이전
# 사용법: ./scripts/transfer-ownership.sh <server> --from <email> --to <email> [--dry-run]
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"
check_deps

SERVER="${1:?사용법: $0 <server> --from <email> --to <email> [--dry-run]}"
shift
load_server_config "$SERVER"

FROM_EMAIL=""
TO_EMAIL=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --from) FROM_EMAIL="$2"; shift 2 ;;
    --to) TO_EMAIL="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$FROM_EMAIL" ] || [ -z "$TO_EMAIL" ]; then
  echo "사용법: $0 <server> --from <퇴사자이메일> --to <인수자이메일> [--dry-run]"
  exit 1
fi

echo "=== 소유권 이전 ==="
echo "서버: $SERVER ($N8N_URL)"
echo "보내는 사람: $FROM_EMAIL"
echo "받는 사람: $TO_EMAIL"
echo "모드: $([ "$DRY_RUN" = true ] && echo 'Dry-run (변경 없음)' || echo '실행')"
echo ""

# 유저 조회
echo "유저 조회 중..."
ALL_USERS=$(fetch_all "users")

FROM_USER=$(echo "$ALL_USERS" | jq -r ".[] | select(.email==\"$FROM_EMAIL\")")
if [ -z "$FROM_USER" ] || [ "$FROM_USER" = "null" ]; then
  echo "오류: $FROM_EMAIL 유저를 찾을 수 없습니다."
  exit 1
fi
FROM_ID=$(echo "$FROM_USER" | jq -r '.id')
FROM_NAME=$(echo "$FROM_USER" | jq -r '(.firstName // "") + " " + (.lastName // "")' | xargs)
echo "보내는 사람: $FROM_NAME <$FROM_EMAIL> (ID: $FROM_ID)"

TO_USER=$(echo "$ALL_USERS" | jq -r ".[] | select(.email==\"$TO_EMAIL\")")
if [ -z "$TO_USER" ] || [ "$TO_USER" = "null" ]; then
  echo "오류: $TO_EMAIL 유저를 찾을 수 없습니다."
  exit 1
fi
TO_ID=$(echo "$TO_USER" | jq -r '.id')
TO_NAME=$(echo "$TO_USER" | jq -r '(.firstName // "") + " " + (.lastName // "")' | xargs)
echo "받는 사람: $TO_NAME <$TO_EMAIL> (ID: $TO_ID)"

# 프로젝트 조회
echo ""
echo "프로젝트 조회 중..."
ALL_PROJECTS=$(curl -s -f \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/projects?limit=250") || { echo "오류: 프로젝트 목록 조회 실패"; exit 1; }
ALL_PROJECTS=$(echo "$ALL_PROJECTS" | jq '.data // []')

# FROM 유저의 personal 프로젝트 찾기
FROM_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\") | select(.name | test(\"$FROM_EMAIL\"; \"i\")) | .id" | head -1)
if [ -z "$FROM_PROJECT_ID" ]; then
  FROM_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\") | select(.name | test(\"$FROM_NAME\"; \"i\")) | .id" | head -1)
fi
if [ -z "$FROM_PROJECT_ID" ]; then
  echo "오류: $FROM_EMAIL의 개인 프로젝트를 찾을 수 없습니다."
  exit 1
fi
echo "보내는 사람 프로젝트: $FROM_PROJECT_ID"

# TO 유저의 personal 프로젝트 찾기
TO_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\") | select(.name | test(\"$TO_EMAIL\"; \"i\")) | .id" | head -1)
if [ -z "$TO_PROJECT_ID" ]; then
  TO_PROJECT_ID=$(echo "$ALL_PROJECTS" | jq -r ".[] | select(.type==\"personal\") | select(.name | test(\"$TO_NAME\"; \"i\")) | .id" | head -1)
fi
if [ -z "$TO_PROJECT_ID" ]; then
  echo "오류: $TO_EMAIL의 개인 프로젝트를 찾을 수 없습니다."
  exit 1
fi
echo "받는 사람 프로젝트: $TO_PROJECT_ID"

# 워크플로우 조회
echo ""
echo "--- 워크플로우 ---"
ALL_WORKFLOWS=$(fetch_all "workflows")
OWNED_WORKFLOWS=$(echo "$ALL_WORKFLOWS" | jq --arg pid "$FROM_PROJECT_ID" \
  '[.[] | select(.shared[]? | .projectId == $pid and .role == "workflow:owner")]')
WF_COUNT=$(echo "$OWNED_WORKFLOWS" | jq 'length')
echo "소유 워크플로우: ${WF_COUNT}개"
if [ "$WF_COUNT" -gt 0 ]; then
  echo "$OWNED_WORKFLOWS" | jq -r '.[] | "  - [\(.id)] \(.name) (active: \(.active))"'
fi

# 크레덴셜 조회
echo ""
echo "--- 크레덴셜 ---"
ALL_CREDENTIALS=$(fetch_all "credentials")
OWNED_CREDENTIALS=$(echo "$ALL_CREDENTIALS" | jq --arg pid "$FROM_PROJECT_ID" \
  '[.[] | select(.homeProject?.id == $pid)]')
CRED_COUNT=$(echo "$OWNED_CREDENTIALS" | jq 'length')
echo "소유 크레덴셜: ${CRED_COUNT}개"
if [ "$CRED_COUNT" -gt 0 ]; then
  echo "$OWNED_CREDENTIALS" | jq -r '.[] | "  - [\(.id)] \(.name) (\(.type))"'
fi

echo ""
echo "총 이전 대상: 워크플로우 ${WF_COUNT}개 + 크레덴셜 ${CRED_COUNT}개"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "(dry-run 모드 — 여기서 종료)"
  exit 0
fi

if [ "$WF_COUNT" -eq 0 ] && [ "$CRED_COUNT" -eq 0 ]; then
  echo "이전할 자산이 없습니다."
  exit 0
fi

echo ""
read -p "$TO_NAME <$TO_EMAIL>에게 이전할까요? (y/N): " CONFIRM
if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
  echo "취소되었습니다."
  exit 0
fi

WF_OK=0
WF_FAIL=0
CRED_OK=0
CRED_FAIL=0

# 워크플로우 이전
for ID in $(echo "$OWNED_WORKFLOWS" | jq -r '.[].id'); do
  NAME=$(echo "$OWNED_WORKFLOWS" | jq -r ".[] | select(.id==\"$ID\") | .name")
  echo -n "  워크플로우 [$ID] $NAME ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"destinationProjectId\": \"$TO_PROJECT_ID\"}" \
    "$N8N_URL/api/v1/workflows/$ID/transfer")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "이전 완료"
    WF_OK=$((WF_OK + 1))
  else
    echo "실패 (HTTP $HTTP_CODE)"
    WF_FAIL=$((WF_FAIL + 1))
  fi
done

# 크레덴셜 이전
for ID in $(echo "$OWNED_CREDENTIALS" | jq -r '.[].id'); do
  NAME=$(echo "$OWNED_CREDENTIALS" | jq -r ".[] | select(.id==\"$ID\") | .name")
  echo -n "  크레덴셜 [$ID] $NAME ... "
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"destinationProjectId\": \"$TO_PROJECT_ID\"}" \
    "$N8N_URL/api/v1/credentials/$ID/transfer")
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "204" ]; then
    echo "이전 완료"
    CRED_OK=$((CRED_OK + 1))
  else
    echo "실패 (HTTP $HTTP_CODE)"
    CRED_FAIL=$((CRED_FAIL + 1))
  fi
done

echo ""
echo "=== 결과 ==="
echo "워크플로우: 성공 ${WF_OK}개, 실패 ${WF_FAIL}개"
echo "크레덴셜: 성공 ${CRED_OK}개, 실패 ${CRED_FAIL}개"
