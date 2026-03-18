#!/bin/bash
# 서버 간 크레덴셜 이관 체크리스트 생성 스크립트
# 사용법: ./scripts/migration-checklist.sh <출발서버> <도착서버>
# 예시:   ./scripts/migration-checklist.sh gcp-vm railway
#
# 출발서버에만 있는 크레덴셜 = 도착서버에 새로 등록 필요
# 양쪽에 있는 크레덴셜     = 이름/타입 확인 필요

set -e
source "$(dirname "$0")/_common.sh"
check_deps

FROM="${1:-}"
TO="${2:-}"

if [ -z "$FROM" ] || [ -z "$TO" ]; then
  echo "사용법: $0 <출발서버> <도착서버>"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

echo "크레덴셜 이관 체크리스트: $FROM → $TO"
echo ""

# 출발서버 크레덴셜 파일 확인
FROM_FILE="$REPO_ROOT/$FROM/credentials/credentials.json"
TO_FILE="$REPO_ROOT/$TO/credentials/credentials.json"

# 파일이 없으면 먼저 list-credentials.sh 실행
if [ ! -f "$FROM_FILE" ]; then
  echo "[$FROM] 크레덴셜 정보가 없습니다. 먼저 조회합니다..."
  bash "$(dirname "$0")/list-credentials.sh" "$FROM"
  echo ""
fi

if [ ! -f "$TO_FILE" ]; then
  echo "[$TO] 크레덴셜 정보가 없습니다. 먼저 조회합니다..."
  bash "$(dirname "$0")/list-credentials.sh" "$TO"
  echo ""
fi

FROM_CREDS=$(cat "$FROM_FILE")
TO_CREDS=$(cat "$TO_FILE")

# 타입+이름 기준으로 비교
FROM_KEYS=$(echo "$FROM_CREDS" | jq -r '.[] | "\(.type):\(.name)"' | sort)
TO_KEYS=$(echo "$TO_CREDS" | jq -r '.[] | "\(.type):\(.name)"' | sort)

ONLY_IN_FROM=$(comm -23 <(echo "$FROM_KEYS") <(echo "$TO_KEYS"))
ONLY_IN_TO=$(comm -13 <(echo "$FROM_KEYS") <(echo "$TO_KEYS"))
IN_BOTH=$(comm -12 <(echo "$FROM_KEYS") <(echo "$TO_KEYS"))

CHECKLIST_FILE="$REPO_ROOT/migration-checklist_${FROM}_to_${TO}.md"

cat > "$CHECKLIST_FILE" << MARKDOWN
# 크레덴셜 이관 체크리스트: $FROM → $TO

생성일: $(date '+%Y-%m-%d %H:%M:%S')

## 새로 등록 필요 ([$FROM]에만 있음)

아래 크레덴셜은 [$TO] 서버에 직접 값을 입력해서 등록해야 합니다.

MARKDOWN

if [ -z "$ONLY_IN_FROM" ]; then
  echo "없음 (모두 이관 완료)" >> "$CHECKLIST_FILE"
else
  echo "$ONLY_IN_FROM" | while IFS=':' read -r TYPE NAME; do
    echo "- [ ] \`[$TYPE]\` **$NAME**" >> "$CHECKLIST_FILE"
  done
fi

cat >> "$CHECKLIST_FILE" << MARKDOWN

## 확인 필요 (양쪽에 동일 이름 존재)

이름이 같더라도 실제 인증 값이 다를 수 있습니다. 워크플로우 실행 후 검증하세요.

MARKDOWN

if [ -z "$IN_BOTH" ]; then
  echo "없음" >> "$CHECKLIST_FILE"
else
  echo "$IN_BOTH" | while IFS=':' read -r TYPE NAME; do
    echo "- [ ] \`[$TYPE]\` **$NAME**" >> "$CHECKLIST_FILE"
  done
fi

cat >> "$CHECKLIST_FILE" << MARKDOWN

## [$TO] 서버에만 있음 (참고)

MARKDOWN

if [ -z "$ONLY_IN_TO" ]; then
  echo "없음" >> "$CHECKLIST_FILE"
else
  echo "$ONLY_IN_TO" | while IFS=':' read -r TYPE NAME; do
    echo "- \`[$TYPE]\` $NAME" >> "$CHECKLIST_FILE"
  done
fi

echo "체크리스트 생성 완료: $CHECKLIST_FILE"
echo ""
echo "── 요약 ────────────────────────────────"
echo "  새로 등록 필요: $(echo "$ONLY_IN_FROM" | grep -c . || echo 0)개"
echo "  양쪽 확인 필요: $(echo "$IN_BOTH" | grep -c . || echo 0)개"
echo "  $TO 전용:       $(echo "$ONLY_IN_TO" | grep -c . || echo 0)개"
