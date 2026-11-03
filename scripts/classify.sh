#!/bin/bash
# 워크플로우 자동 분류(태깅) 스크립트
#
# 사용법: ./scripts/classify.sh <서버명> [--apply]
#
# 규칙 기반으로 워크플로우를 분류하고 태그를 할당합니다.
#   - [프로젝트] 패턴 → 프로젝트명 태그
#   - 키워드 매칭: slack, github, google, notion, ai/llm/gpt/claude → 해당 태그
#   - 분류 불가 → "미분류" 태그
#
# --apply 없이 실행하면 dry-run (미리보기만)

set -e
source "$(dirname "$0")/_common.sh"
check_deps

SERVER="${1:-}"
APPLY=false

shift || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=true; shift ;;
    *) echo "알 수 없는 옵션: $1"; exit 1 ;;
  esac
done

if [ -z "$SERVER" ]; then
  echo "사용법: $0 <서버명> [--apply]"
  echo "서버명: cloud | gcp-vm | railway | raspberry-pi"
  exit 1
fi

load_server_config "$SERVER"

# ── 데이터 수집 ─────────────────────────────────────
echo ""
if $APPLY; then
  echo "[apply] 워크플로우 분류 시작... (서버: $SERVER)"
else
  echo "[dry-run] 워크플로우 분류 시작... (서버: $SERVER)"
fi
echo ""

TMP_WORKFLOWS=$(mktemp /tmp/n8n_classify_wf_XXXXXX.json)
TMP_TAGS=$(mktemp /tmp/n8n_classify_tags_XXXXXX.json)

fetch_all "workflows" > "$TMP_WORKFLOWS"

# 태그는 페이지네이션 불필요
curl -s -f \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Accept: application/json" \
  "$N8N_URL/api/v1/tags" | jq '.' > "$TMP_TAGS"

# n8n API는 태그를 { data: [...] } 또는 직접 배열로 반환할 수 있음
EXISTING_TAGS=$(jq 'if type == "array" then . else (.data // []) end' "$TMP_TAGS")
EXISTING_TAG_NAMES=$(echo "$EXISTING_TAGS" | jq -r '.[].name' | sort | paste -sd', ' -)
echo "기존 태그: ${EXISTING_TAG_NAMES:-없음}"
echo ""

# ── 분류 로직 (Python) ──────────────────────────────
TMP_PY=$(mktemp /tmp/n8n_classify_XXXXXX.py)
cat > "$TMP_PY" << 'PYEOF'
import json, sys, re

with open(sys.argv[1]) as f:
    workflows = json.load(f)

existing_tags = json.loads(sys.argv[2])
tag_map = {t['name'].lower(): t for t in existing_tags}

# 키워드 → 태그 매핑
KEYWORD_RULES = [
    (r'\bslack\b', 'slack'),
    (r'\bgithub\b', 'github'),
    (r'\bgoogle\b', 'google'),
    (r'\bnotion\b', 'notion'),
    (r'\b(ai|llm|gpt|claude|openai|chatgpt|gemini)\b', 'ai-agent'),
]

results = []
new_tags_needed = set()

for w in workflows:
    wf_id = w['id']
    wf_name = w['name']
    existing_wf_tags = w.get('tags') or []

    # 이미 태그가 있으면 스킵
    if existing_wf_tags:
        results.append({
            'id': wf_id,
            'name': wf_name,
            'status': 'already_tagged',
            'current_tags': [t['name'] for t in existing_wf_tags],
            'new_tags': [],
        })
        continue

    assigned_tags = []

    # 규칙 1: [프로젝트] 패턴
    project_match = re.match(r'^\[([^\]]+)\]', wf_name)
    if project_match:
        tag_name = project_match.group(1).strip().lower()
        assigned_tags.append(tag_name)

    # 규칙 2: 키워드 매칭
    name_lower = wf_name.lower()
    for pattern, tag_name in KEYWORD_RULES:
        if re.search(pattern, name_lower):
            if tag_name not in assigned_tags:
                assigned_tags.append(tag_name)

    # 규칙 3: 분류 불가 → 미분류
    if not assigned_tags:
        assigned_tags.append('미분류')

    for t in assigned_tags:
        if t.lower() not in tag_map:
            new_tags_needed.add(t)

    results.append({
        'id': wf_id,
        'name': wf_name,
        'status': 'classified',
        'current_tags': [],
        'new_tags': assigned_tags,
    })

output = {
    'results': results,
    'new_tags_needed': sorted(new_tags_needed),
    'total': len(workflows),
    'already_tagged': sum(1 for r in results if r['status'] == 'already_tagged'),
    'newly_classified': sum(1 for r in results if r['status'] == 'classified'),
}
print(json.dumps(output, ensure_ascii=False))
PYEOF

CLASSIFICATION=$(python3 "$TMP_PY" "$TMP_WORKFLOWS" "$(echo "$EXISTING_TAGS")")
rm -f "$TMP_PY"

# ── 결과 출력 ────────────────────────────────────────
echo "$CLASSIFICATION" | python3 -c "
import json, sys
data = json.load(sys.stdin)

for r in data['results']:
    if r['status'] == 'already_tagged':
        tags_str = ', '.join(r['current_tags'])
        print(f'  ✅ \"{r[\"name\"]}\" (ID: {r[\"id\"]}) → 이미 태그됨 [{tags_str}]')
    else:
        tags_str = ', '.join(r['new_tags'])
        print(f'  📁 \"{r[\"name\"]}\" (ID: {r[\"id\"]}) → [{tags_str}]')

print()
print(f'요약: 전체 {data[\"total\"]}개 | 신규 분류 {data[\"newly_classified\"]}개 | 이미 태그됨 {data[\"already_tagged\"]}개')

if data['new_tags_needed']:
    print(f'생성 필요 태그: {\", \".join(data[\"new_tags_needed\"])}')
"

# ── dry-run 종료 ─────────────────────────────────────
if ! $APPLY; then
  echo ""
  echo "--apply 옵션으로 실제 적용하세요:"
  echo "  $0 $SERVER --apply"
  rm -f "$TMP_WORKFLOWS" "$TMP_TAGS"
  exit 0
fi

# ── 실제 적용 ────────────────────────────────────────
echo ""
echo "태그 적용 중..."

# 1. 필요한 태그 생성
NEW_TAGS_JSON=$(echo "$CLASSIFICATION" | jq -r '.new_tags_needed[]')
TAG_MAP_FILE=$(mktemp /tmp/n8n_tag_map_XXXXXX.json)
echo "$EXISTING_TAGS" > "$TAG_MAP_FILE"

while IFS= read -r TAG_NAME; do
  [ -z "$TAG_NAME" ] && continue
  echo "  태그 생성: $TAG_NAME"
  CREATED=$(curl -s -f \
    -X POST \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json" \
    "$N8N_URL/api/v1/tags" \
    -d "{\"name\": \"$TAG_NAME\"}") || { echo "  오류: 태그 생성 실패 ($TAG_NAME)"; continue; }
  # 태그 맵에 추가
  jq --argjson new "$CREATED" '. + [$new]' "$TAG_MAP_FILE" > "${TAG_MAP_FILE}.new" && mv "${TAG_MAP_FILE}.new" "$TAG_MAP_FILE"
done <<< "$NEW_TAGS_JSON"

# 2. 워크플로우에 태그 할당
UPDATED=0
FAILED=0

echo "$CLASSIFICATION" | jq -c '.results[] | select(.status == "classified")' | while IFS= read -r ITEM; do
  WF_ID=$(echo "$ITEM" | jq -r '.id')
  WF_NAME=$(echo "$ITEM" | jq -r '.name')
  NEW_TAGS=$(echo "$ITEM" | jq -r '.new_tags[]')

  # 태그 ID 배열 구성
  TAG_IDS="[]"
  while IFS= read -r T; do
    [ -z "$T" ] && continue
    TAG_ID=$(jq -r --arg name "$T" '.[] | select(.name == $name) | .id' "$TAG_MAP_FILE")
    if [ -n "$TAG_ID" ]; then
      TAG_IDS=$(echo "$TAG_IDS" | jq --arg id "$TAG_ID" '. + [{"id": $id}]')
    fi
  done <<< "$NEW_TAGS"

  # 워크플로우 업데이트 (태그만)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PATCH \
    -H "X-N8N-API-KEY: $API_KEY" \
    -H "Content-Type: application/json" \
    "$N8N_URL/api/v1/workflows/$WF_ID" \
    -d "{\"tags\": $TAG_IDS}")

  TAGS_STR=$(echo "$ITEM" | jq -r '.new_tags | join(", ")')
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo "  적용됨: \"$WF_NAME\" → [$TAGS_STR]"
  else
    echo "  실패 (HTTP $HTTP_CODE): \"$WF_NAME\""
  fi
done

rm -f "$TMP_WORKFLOWS" "$TMP_TAGS" "$TAG_MAP_FILE"
echo ""
echo "분류 완료!"
