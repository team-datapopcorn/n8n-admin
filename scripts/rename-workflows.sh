#!/bin/bash
# 워크플로우 네이밍 컨벤션 검사 및 일괄 변경 스크립트
#
# 사용법: ./scripts/rename-workflows.sh <서버명> [--execute]
# 예시:   ./scripts/rename-workflows.sh server1
#         ./scripts/rename-workflows.sh server2 --execute
#
# 컨벤션 패턴: [프로젝트명] 기능 설명
# 예: [인프런] Slack 알림 자동 발송
#
# 옵션:
#   (없음)        dry-run — 위반 목록과 제안만 출력
#   --execute     실제 이름 변경 적용

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
EXECUTE=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute) EXECUTE=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명> [--execute]"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

load_server_config "$SERVER"

MODE="dry-run"
$EXECUTE && MODE="execute"

echo "[$MODE] 컨벤션 검사 시작... (서버: $SERVER)"
echo ""

# 전체 워크플로우 수집
TMP_DATA=$(mktemp /tmp/n8n_workflows_XXXXXX.json)
fetch_all "workflows" > "$TMP_DATA"

# Python으로 컨벤션 분석
TMP_PY=$(mktemp /tmp/n8n_convention_XXXXXX.py)
cat > "$TMP_PY" << 'PYEOF'
import json, sys, re

with open(sys.argv[1]) as f:
    workflows = json.load(f)

CONVENTION_RE = re.compile(r'^\[([^\]]+)\]\s+(.+)$')
COPY_VERSION_RE = re.compile(r'\(copy\)|\bcopy\b\s*\d*$|\s*v\d+(\.\d+)*$|\s*mk\d+$', re.I)
DEFAULT_NAME_RE = re.compile(r'^(my\s+)?(workflow|sub-workflow)(\s+\d+)?$', re.I)

def clean_name(name):
    n = name
    n = re.sub(r'^\(Copy\)\s*', '', n)
    n = re.sub(r'\s*\(copy\)\s*\d*', '', n, flags=re.I)
    n = re.sub(r'\s+copy\s*\d*$', '', n, flags=re.I)
    n = re.sub(r'\s*v\d+(\.\d+)*$', '', n)
    n = re.sub(r'\s*mk\d+$', '', n)
    n = re.sub(r'\s*\([^)]*\)', '', n)
    return n.strip()

violations = []
compliant = 0

for wf in workflows:
    name = wf['name'].strip()
    wf_id = wf['id']

    if CONVENTION_RE.match(name):
        # 컨벤션 준수, 하지만 복사/버전 마커가 있는지 확인
        if COPY_VERSION_RE.search(name):
            cleaned = clean_name(name)
            m = CONVENTION_RE.match(cleaned)
            if m:
                suggested = cleaned
            else:
                suggested = f'[미분류] {cleaned}' if cleaned else f'[미분류] {name}'
            violations.append({
                'id': wf_id,
                'name': name,
                'suggested': suggested,
                'reasons': ['복사/버전 마커 포함']
            })
        else:
            compliant += 1
        continue

    reasons = []
    reasons.append('프로젝트 태그 없음')

    if DEFAULT_NAME_RE.match(name):
        reasons.append('기본 이름')

    if COPY_VERSION_RE.search(name):
        reasons.append('복사/버전 마커')

    cleaned = clean_name(name)
    if not cleaned:
        cleaned = '미분류 워크플로우'

    suggested = f'[미분류] {cleaned}'

    violations.append({
        'id': wf_id,
        'name': name,
        'suggested': suggested,
        'reasons': reasons
    })

result = {
    'violations': violations,
    'total': len(workflows),
    'compliant': compliant
}

print(json.dumps(result, ensure_ascii=False))
PYEOF

ANALYSIS=$(python3 "$TMP_PY" "$TMP_DATA")
rm -f "$TMP_DATA" "$TMP_PY"

TOTAL=$(echo "$ANALYSIS" | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
COMPLIANT=$(echo "$ANALYSIS" | python3 -c "import json,sys; print(json.load(sys.stdin)['compliant'])")
VIOLATION_COUNT=$(echo "$ANALYSIS" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['violations']))")

# ── 위반 목록 출력 ───────────────────────────────────
echo "$ANALYSIS" | python3 -c "
import json, sys

data = json.load(sys.stdin)
violations = data['violations']

if not violations:
    print('모든 워크플로우가 컨벤션을 준수합니다.')
    sys.exit()

for i, v in enumerate(violations, 1):
    print(f'위반 #{i}: \"{v[\"name\"]}\" (ID: {v[\"id\"]})')
    print(f'  → 제안: {v[\"suggested\"]}')
    print(f'  → 사유: {\", \".join(v[\"reasons\"])}')
    print()
"

echo "요약: 전체 ${TOTAL}개 | 준수 ${COMPLIANT}개 | 위반 ${VIOLATION_COUNT}개"
echo ""

if [ "$VIOLATION_COUNT" -eq 0 ]; then
  exit 0
fi

# ── dry-run 종료 ─────────────────────────────────────
if ! $EXECUTE; then
  echo "──────────────────────────────────────────────────"
  echo "dry-run 모드입니다. 실제 변경하려면 --execute를 추가하세요:"
  echo "  $0 $SERVER --execute"
  exit 0
fi

# ── 실제 이름 변경 ──────────────────────────────────
echo "──────────────────────────────────────────────────"
echo "경고: ${VIOLATION_COUNT}개 워크플로우의 이름을 변경합니다."
read -p "계속하시겠습니까? (yes 입력): " CONFIRM
[ "$CONFIRM" != "yes" ] && { echo "취소되었습니다."; exit 0; }

RENAMED=0
FAILED=0

while IFS='|' read -r WF_ID OLD_NAME NEW_NAME; do
  # 기존 워크플로우 데이터 가져오기
  WF_DATA=$(curl -s -f \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Accept: application/json" \
    "$N8N_URL/api/v1/workflows/$WF_ID") || { echo "  실패 (조회 오류): $OLD_NAME"; FAILED=$((FAILED + 1)); continue; }

  # 이름만 변경하여 업데이트
  UPDATED=$(echo "$WF_DATA" | jq --arg name "$NEW_NAME" '.name = $name')

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$UPDATED" \
    "$N8N_URL/api/v1/workflows/$WF_ID")

  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "  변경됨: \"$OLD_NAME\" → \"$NEW_NAME\""
    RENAMED=$((RENAMED + 1))
  else
    echo "  실패 (HTTP $HTTP_CODE): $OLD_NAME"
    FAILED=$((FAILED + 1))
  fi
done < <(echo "$ANALYSIS" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for v in data['violations']:
    # pipe-separated: id|old_name|suggested_name
    print(v['id'] + '|' + v['name'] + '|' + v['suggested'])
")

echo ""
echo "완료 — 변경: ${RENAMED}개 / 실패: ${FAILED}개"
