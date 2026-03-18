#!/bin/bash
# 크레덴셜 목록 저장 스크립트
# 사용법: ./scripts/list-credentials.sh <서버명>
# 예시:   ./scripts/list-credentials.sh cloud
#
# 주의: n8n API는 보안상 크레덴셜 실제 값(비밀번호, 토큰)을 절대 반환하지 않습니다.
#       이름, 타입, 생성일만 저장됩니다.

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명>"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

load_server_config "$SERVER"

OUTPUT_DIR="$REPO_ROOT/$SERVER/credentials"
OUTPUT_FILE="$OUTPUT_DIR/credentials.json"
mkdir -p "$OUTPUT_DIR"

echo "[$SERVER] 크레덴셜 목록 조회 중..."

DATA=$(fetch_all "credentials")

# 필요한 필드만 추출 (실제 값 제외)
SUMMARY=$(echo "$DATA" | jq '[.[] | {
  id,
  name,
  type,
  createdAt,
  updatedAt
}] | sort_by(.type, .name)')

echo "$SUMMARY" | jq '.' > "$OUTPUT_FILE"

COUNT=$(echo "$SUMMARY" | jq 'length')
echo ""
echo "완료: $COUNT개 크레덴셜 정보를 저장했습니다."
echo "파일: $OUTPUT_FILE"
echo ""
echo "── 크레덴셜 목록 ──────────────────────"
echo "$SUMMARY" | jq -r '.[] | "  [\(.type)] \(.name)"'
