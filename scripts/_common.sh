#!/bin/bash
# 공통 함수 모음 - 다른 스크립트에서 source로 불러서 사용
# 직접 실행하지 마세요.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# 의존성 확인
check_deps() {
  if ! command -v jq &> /dev/null; then
    echo "오류: jq가 설치되어 있지 않습니다. brew install jq 로 설치하세요."
    exit 1
  fi
}

# .env 로드 및 서버별 URL/API_KEY 설정
load_server_config() {
  local server="$1"

  if [ ! -f "$ENV_FILE" ]; then
    echo "오류: .env 파일이 없습니다."
    echo "cp .env.example .env 후 SERVER_URL과 SERVER_API_KEY를 입력하세요."
    exit 1
  fi
  source "$ENV_FILE"

  case "$server" in
    server1) N8N_URL="${SERVER_URL:-}";  API_KEY="${SERVER_API_KEY:-}" ;;
    server2) N8N_URL="${SERVER2_URL:-}"; API_KEY="${SERVER2_API_KEY:-}" ;;
    server3) N8N_URL="${SERVER3_URL:-}"; API_KEY="${SERVER3_API_KEY:-}" ;;
    # 서버 추가 시 여기에 한 줄 추가하고, .env에도 SERVER4_* 항목을 추가하세요.
    # server4) N8N_URL="${SERVER4_URL:-}"; API_KEY="${SERVER4_API_KEY:-}" ;;
    *)
      echo "오류: 알 수 없는 서버명 '$server'"
      echo "사용법: ./scripts/export.sh server1"
      echo "서버 목록: server1 | server2 | server3"
      exit 1
      ;;
  esac

  if [ -z "$N8N_URL" ] || [ -z "$API_KEY" ]; then
    echo "오류: .env 파일에서 '$server' 서버의 URL 또는 API_KEY가 설정되지 않았습니다."
    echo ".env.example을 참고해 해당 서버 항목을 채워주세요."
    exit 1
  fi

  export N8N_URL API_KEY
}

# n8n API 호출 (페이지네이션 자동 처리, 전체 data 배열 반환)
# 큰 JSON 처리를 위해 임시 파일 사용
fetch_all() {
  local endpoint="$1"
  local tmp_file
  tmp_file=$(mktemp /tmp/n8n_fetch_XXXXXX.json)
  echo "[]" > "$tmp_file"
  local cursor=""

  while true; do
    # users는 includeRole=true가 없으면 role이 빠진다 (owner/admin 보호 로직이 무력화됨)
    local query="limit=100"
    [ "$endpoint" = "users" ] && query="includeRole=true&limit=100"
    local url="$N8N_URL/api/v1/${endpoint}?${query}${cursor:+&cursor=$cursor}"
    local response
    response=$(curl -s -f \
      -H "X-N8N-API-KEY: $API_KEY" \
      -H "Accept: application/json" \
      "$url") || { echo "오류: API 호출 실패 ($url)"; rm -f "$tmp_file"; exit 1; }

    echo "$response" | jq '.data' | jq -s '.[0] + .[1]' "$tmp_file" - > "${tmp_file}.new" && mv "${tmp_file}.new" "$tmp_file"

    cursor=$(echo "$response" | jq -r '.nextCursor // empty')
    [ -z "$cursor" ] && break
  done

  cat "$tmp_file"
  rm -f "$tmp_file"
}

# ─── n8n 2.x/3.x 호환 ────────────────────────────────────────────────
# n8n 2.0부터 POST/PUT /workflows 본문이 strict 검증이라 GET 결과를 그대로 보내면
# active·activeVersionId·tags 등 읽기 전용 필드 때문에 400이 난다. 쓰기 가능한 필드만 남긴다.
N8N_WRITABLE_JQ='
  def nn: with_entries(select(.value != null));
  {
    name,
    nodes: ((.nodes // []) | map({id, name, webhookId, disabled, notesInFlow, notes, type, typeVersion,
      executeOnce, alwaysOutputData, retryOnFail, maxTries, waitBetweenTries, continueOnFail, onError,
      position, parameters, credentials} | nn)),
    connections: (.connections // {}),
    settings: (((.settings // {}) | with_entries(select(.value != null and (.key as $k |
      ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution",
       "executionTimeout","errorWorkflow","timezone","executionOrder","callerPolicy","callerIds",
       "timeSavedMode","timeSavedPerExecution","redactionPolicy","availableInMCP"] | index($k)))))
      | (if (.saveDataErrorExecution // "all") as $v | ["all","none"] | index($v) then . else del(.saveDataErrorExecution) end)
      | (if (.saveDataSuccessExecution // "all") as $v | ["all","none"] | index($v) then . else del(.saveDataSuccessExecution) end)),
    staticData,
    description,
    nodeGroups: (if (.nodeGroups | type) == "array" and (.nodeGroups | length) > 0 then .nodeGroups else null end)
  } | nn'

# 워크플로우 게시 (n8n 1.x의 activate). 2.0+는 /publish, 구버전은 /activate로 폴백.
# 사용: publish_workflow <URL> <API_KEY> <WF_ID>  → HTTP 코드 출력
publish_workflow() {
  local url="$1" key="$2" id="$3" code
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "X-N8N-API-KEY: $key" -H "Content-Type: application/json" -d '{}' \
    "$url/api/v1/workflows/$id/publish")
  if [ "$code" = "404" ] || [ "$code" = "405" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
      -H "X-N8N-API-KEY: $key" "$url/api/v1/workflows/$id/activate")
  fi
  echo "$code"
}
