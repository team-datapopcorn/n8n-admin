#!/bin/bash
# n8n Admin 셋업 스크립트
# 사용법: ./setup.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"
ENV_FILE="$REPO_ROOT/.env"

echo "=== n8n Admin 셋업 ==="
echo ""

# 1. 필수 도구 확인
echo "--- 필수 도구 확인 ---"
MISSING=()
if ! command -v node &>/dev/null; then
  MISSING+=("Node.js (https://nodejs.org)")
fi
if ! command -v pnpm &>/dev/null; then
  MISSING+=("pnpm (npm install -g pnpm)")
fi
if ! command -v jq &>/dev/null; then
  MISSING+=("jq (brew install jq)")
fi

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "다음 도구가 필요합니다:"
  for tool in "${MISSING[@]}"; do
    echo "  - $tool"
  done
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "Node.js 18 이상이 필요합니다. 현재: $(node -v)"
  exit 1
fi
echo "Node.js $(node -v), pnpm $(pnpm -v), jq $(jq --version 2>&1 | head -1) 확인 완료"

# 2. 의존성 설치
echo ""
echo "--- 의존성 설치 ---"
cd admin && pnpm install && cd "$REPO_ROOT"
npm install
echo "의존성 설치 완료"

# 3. .env 파일 생성
echo ""
echo "--- 서버 설정 ---"
SKIP_ENV=false
if [ -f "$ENV_FILE" ]; then
  read -p ".env 파일이 이미 있습니다. 덮어쓸까요? (y/N): " OVERWRITE
  if [[ "$OVERWRITE" != "y" && "$OVERWRITE" != "Y" ]]; then
    echo ".env 파일을 유지합니다."
    SKIP_ENV=true
  fi
fi

if [ "$SKIP_ENV" != "true" ]; then
  echo "n8n 서버 정보를 입력해주세요."
  echo ""

  read -p "서버 이름 (기본: My n8n Server): " SERVER_NAME
  SERVER_NAME="${SERVER_NAME:-My n8n Server}"

  read -p "n8n 서버 URL (예: https://your-n8n.com): " SERVER_URL
  SERVER_URL="${SERVER_URL%/}"

  echo "연결 테스트 중..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${SERVER_URL}/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "000" ]; then
    echo "경고: 서버에 연결할 수 없습니다. URL을 확인해주세요."
    read -p "계속 진행할까요? (y/N): " CONTINUE
    [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]] && exit 1
  else
    echo "서버 응답 확인 (HTTP $HTTP_CODE)"
  fi

  read -p "n8n API 키: " SERVER_API_KEY

  echo "API 키 검증 중..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 \
    -H "X-N8N-API-KEY: ${SERVER_API_KEY}" \
    "${SERVER_URL}/api/v1/workflows?limit=1" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "API 키 검증 성공!"
  else
    echo "경고: API 키 검증 실패 (HTTP $HTTP_CODE). n8n → Settings → API에서 키를 확인해주세요."
    read -p "계속 진행할까요? (y/N): " CONTINUE
    [[ "$CONTINUE" != "y" && "$CONTINUE" != "Y" ]] && exit 1
  fi

  read -sp "관리자 비밀번호 (기본: admin1234): " ADMIN_PASSWORD
  echo ""
  ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin1234}"

  NEXTAUTH_SECRET=$(openssl rand -base64 32)

  cat > "$ENV_FILE" <<ENVEOF
APP_NAME="n8n Admin"

SERVER_NAME="${SERVER_NAME}"
SERVER_URL=${SERVER_URL}
SERVER_API_KEY=${SERVER_API_KEY}

ADMIN_PASSWORD=${ADMIN_PASSWORD}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=http://localhost:3000
ENVEOF

  echo ".env 파일 생성 완료"
fi

# 4. Claude Code 연결
echo ""
echo "--- Claude Code 연결 ---"
if command -v claude &>/dev/null; then
  echo "Claude Code 감지됨"
  echo "프로젝트 폴더에서 'claude'를 실행하면 n8n 스킬이 자동 로드됩니다."
else
  echo "Claude Code가 설치되어 있지 않습니다."
  echo "설치: npm install -g @anthropic-ai/claude-code"
  echo "(선택 사항 — n8n-admin 대시보드는 Claude Code 없이도 사용 가능합니다)"
fi

# 5. 완료
echo ""
echo "=== 셋업 완료! ==="
echo ""
echo "다음 단계:"
echo "  1. 웹 대시보드 실행:  cd admin && pnpm dev"
echo "  2. 브라우저에서 열기:  http://localhost:3000"
echo "  3. Claude Code 실행:  claude  (프로젝트 루트에서)"
echo ""
