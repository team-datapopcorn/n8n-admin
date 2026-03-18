#!/bin/bash
# 중복 워크플로우 정리 스크립트
#
# 사용법: ./scripts/cleanup-workflows.sh <서버명> [옵션]
#
# 옵션:
#   (없음)              중복 분석 + 삭제 후보 목록만 출력 (dry-run)
#   --execute           실제 삭제 실행 (서버 + 로컬 파일)
#   --my-workflows      "My workflow" 기본 이름 계열 비활성 워크플로우만 대상
#
# 삭제 기준:
#   A. "My workflow*" / "My Sub-Workflow*" 이름 + 비활성
#   B. 완전 동일 이름 그룹 내 비활성 + 오래된 것 (최신 1개 보존)
#   C. "(Copy)" 포함 + 비활성
#
# 보호 대상:
#   - active=true 워크플로우는 절대 삭제하지 않음

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
EXECUTE=false
MY_WORKFLOWS_ONLY=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --execute)       EXECUTE=true; shift ;;
    --my-workflows)  MY_WORKFLOWS_ONLY=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명> [--execute] [--my-workflows]"
  echo "서버명: server1 | server2 | server3"
  exit 1
fi

load_server_config "$SERVER"

WORKFLOWS_DIR="$REPO_ROOT/$SERVER/workflows"
LOG_FILE="$REPO_ROOT/$SERVER/cleanup-log-$(date '+%Y%m%d-%H%M%S').md"

echo "[$SERVER] 워크플로우 중복 분석 중..."
echo ""

# 전체 워크플로우 수집 → 임시 파일로 저장
TMP_DATA=$(mktemp /tmp/n8n_workflows_XXXXXX.json)
fetch_all "workflows" > "$TMP_DATA"

# Python 분석 스크립트를 임시 파일로 저장
TMP_PY=$(mktemp /tmp/n8n_analyze_XXXXXX.py)
cat > "$TMP_PY" << 'PYEOF'
import json, sys, re
from collections import defaultdict

with open(sys.argv[1]) as f:
    workflows = json.load(f)

def normalize(name):
    n = name
    n = re.sub(r'^\(Copy\)\s*', '', n)
    n = re.sub(r'\s*\(copy\)\s*\d*', '', n, flags=re.I)
    n = re.sub(r'\s+copy\s*\d*$', '', n, flags=re.I)
    n = re.sub(r'\s*v\d+(\.\d+)*$', '', n)
    n = re.sub(r'\s*mk\d+$', '', n)
    n = re.sub(r'^\d+[\s_-]*', '', n)
    n = re.sub(r'\s*\([^)]*\)', '', n)
    n = n.strip().lower()
    return n

def is_my_workflow(name):
    return bool(re.match(r'^my (workflow|sub-workflow)(\s+\d+)?$', name.strip(), re.I))

def is_copy(name):
    return '(copy)' in name.lower() or bool(re.search(r'\bcopy\b', name, re.I))

groups = defaultdict(list)
for w in workflows:
    key = normalize(w['name'])
    groups[key].append(w)

candidates = []
protected = []

for key, items in groups.items():
    if len(items) < 2:
        continue

    active_items   = [w for w in items if w['active']]
    inactive_items = [w for w in items if not w['active']]

    if len(active_items) == len(items):
        protected.append({'reason': '모두 활성 (수동 확인 필요)', 'items': items})
        continue

    for w in inactive_items:
        reason = None
        if is_my_workflow(w['name']):
            reason = 'My workflow 기본이름+비활성'
        elif is_copy(w['name']):
            reason = '(Copy) 포함+비활성'
        elif len([x for x in items if x['name'] == w['name']]) > 1:
            same_name = sorted(
                [x for x in items if x['name'] == w['name']],
                key=lambda x: x['updatedAt'], reverse=True
            )
            if w['id'] != same_name[0]['id']:
                reason = '동일이름 중복+비활성 (오래된 것)'

        if reason:
            candidates.append({
                'id': w['id'],
                'name': w['name'],
                'reason': reason,
                'updatedAt': w['updatedAt'][:10]
            })

print(json.dumps({
    'candidates': candidates,
    'protected': protected,
    'total': len(workflows)
}))
PYEOF

ANALYSIS=$(python3 "$TMP_PY" "$TMP_DATA")
rm -f "$TMP_DATA" "$TMP_PY"

CANDIDATES=$(echo "$ANALYSIS" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['candidates']))")
PROTECTED=$(echo "$ANALYSIS"  | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['protected']))")
TOTAL=$(echo "$ANALYSIS"      | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
COUNT=$(echo "$CANDIDATES"    | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
PCOUNT=$(echo "$PROTECTED"   | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")

# --my-workflows 옵션이면 A 카테고리만 필터
if $MY_WORKFLOWS_ONLY; then
  CANDIDATES=$(echo "$CANDIDATES" | python3 -c "
import json,sys
print(json.dumps([c for c in json.load(sys.stdin) if 'My workflow' in c['reason']]))
")
  COUNT=$(echo "$CANDIDATES" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))")
fi

# ── 삭제 후보 출력 ───────────────────────────────────
echo "── 삭제 후보 목록 (${COUNT}개 / 전체 ${TOTAL}개) ─────────"
echo ""
echo "$CANDIDATES" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data:
    print('  없음')
    sys.exit()
by_reason = {}
for c in data:
    by_reason.setdefault(c['reason'], []).append(c)
for reason, items in sorted(by_reason.items()):
    print(f'[{len(items)}개] {reason}')
    for w in sorted(items, key=lambda x: x['updatedAt']):
        print(f'  - {w[\"name\"]}  ({w[\"updatedAt\"]})')
    print()
"

# ── 수동 확인 필요 그룹 출력 ─────────────────────────
if [ "$PCOUNT" -gt 0 ]; then
  echo "── 수동 확인 필요 (${PCOUNT}개 그룹) ───────────────────"
  echo ""
  echo "$PROTECTED" | python3 -c "
import json, sys
for g in json.load(sys.stdin):
    print(f'  [{g[\"reason\"]}]')
    for w in g['items']:
        print(f'    [{\"ON \" if w[\"active\"] else \"OFF\"}] {w[\"name\"]}')
    print()
"
fi

if [ "$COUNT" -eq 0 ]; then
  echo "삭제 후보가 없습니다."
  exit 0
fi

# ── dry-run 종료 ─────────────────────────────────────
if ! $EXECUTE; then
  echo "──────────────────────────────────────────────────"
  echo "dry-run 모드입니다. 실제 삭제하려면 --execute를 추가하세요:"
  echo "  $0 $SERVER --execute"
  $MY_WORKFLOWS_ONLY && echo "  (현재 --my-workflows 옵션 적용 중)"
  exit 0
fi

# ── 실제 삭제 ────────────────────────────────────────
echo "──────────────────────────────────────────────────"
echo "경고: ${COUNT}개 워크플로우를 삭제합니다. (active 워크플로우는 포함되지 않음)"
read -p "계속하시겠습니까? (yes 입력): " CONFIRM
[ "$CONFIRM" != "yes" ] && { echo "취소되었습니다."; exit 0; }

cat > "$LOG_FILE" << LOGHEADER
# 워크플로우 정리 로그

- 서버: $SERVER
- 실행일: $(date '+%Y-%m-%d %H:%M:%S')
- 삭제 대상: ${COUNT}개

## 삭제 내역

LOGHEADER

DELETED=0
FAILED=0

while IFS='|' read -r WF_ID WF_NAME WF_REASON; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "X-N8N-API-KEY: $API_KEY" \
    "$N8N_URL/api/v1/workflows/$WF_ID")

  if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
    echo "  삭제됨: $WF_NAME"
    echo "- [삭제] \`$WF_NAME\` (id: \`$WF_ID\`) — $WF_REASON" >> "$LOG_FILE"

    # 로컬 JSON 파일도 제거
    SAFE_NAME=$(echo "$WF_NAME" | tr ' /' '_' | tr -cd '[:alnum:]_-')
    LOCAL_FILE=$(ls "$WORKFLOWS_DIR/${SAFE_NAME}_${WF_ID}.json" 2>/dev/null || true)
    [ -n "$LOCAL_FILE" ] && rm "$LOCAL_FILE"

    DELETED=$((DELETED + 1))
  else
    echo "  실패 (HTTP $HTTP_CODE): $WF_NAME"
    echo "- [실패] \`$WF_NAME\` (id: \`$WF_ID\`) — HTTP $HTTP_CODE" >> "$LOG_FILE"
    FAILED=$((FAILED + 1))
  fi
done < <(echo "$CANDIDATES" | python3 -c "
import json,sys
for c in json.load(sys.stdin):
    print(c['id']+'|'+c['name']+'|'+c['reason'])
")

echo ""
echo "완료 — 삭제: ${DELETED}개 / 실패: ${FAILED}개"
echo "로그: $LOG_FILE"
