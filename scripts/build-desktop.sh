#!/bin/bash
# n8n Admin Desktop 빌드 스크립트
# 사용법: ./scripts/build-desktop.sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# 의존성 확인
command -v pnpm >/dev/null 2>&1 || { echo "오류: pnpm이 필요합니다. npm install -g pnpm 으로 설치하세요."; exit 1; }

echo "=== 1/4: Next.js standalone 빌드 ==="
cd admin
pnpm install --frozen-lockfile
pnpm build
cd "$REPO_ROOT"

echo "=== 2/4: standalone 출력물 복사 ==="
rm -rf build/standalone
mkdir -p build/standalone
cp -r admin/.next/standalone/* build/standalone/
cp -r admin/.next/static build/standalone/admin/.next/static
cp -r admin/public build/standalone/admin/public

echo "=== 3/4: Electron 코드 컴파일 ==="
npx tsc -p desktop/tsconfig.json

echo "=== 4/4: Electron 앱 빌드 (DMG) ==="
npx electron-builder --mac

echo ""
echo "빌드 완료! DMG 파일:"
ls -la dist/*.dmg
