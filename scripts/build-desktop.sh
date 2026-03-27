#!/bin/bash
# n8n Admin Desktop 빌드 스크립트
# 사용법: ./scripts/build-desktop.sh [mac|win|all|auto]
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

# rsync -aL로 심볼릭 링크를 역참조하여 실제 파일로 복사
# (electron-builder는 심볼릭 링크를 처리하지 못함)
rsync -aL \
  --exclude='**/@img+sharp-*' \
  --exclude='**/*.map' \
  admin/.next/standalone/ build/standalone/ 2>/dev/null || true
mkdir -p build/standalone/admin/.next
rsync -aL admin/.next/static/ build/standalone/admin/.next/static/
rsync -aL admin/public/ build/standalone/admin/public/

# pnpm 호이스팅 수정: .pnpm/node_modules/* 의 패키지를 top-level로 복사
# (rsync -aL 후 pnpm 모듈 해석이 깨지는 것을 보정)
NMDIR="build/standalone/admin/node_modules"
if [ -d "$NMDIR/.pnpm/node_modules" ]; then
  echo "  pnpm 모듈 호이스팅 중..."
  for pkg in "$NMDIR/.pnpm/node_modules"/*; do
    name=$(basename "$pkg")
    # 스코프 패키지(@swc, @next 등)
    if [[ "$name" == @* ]] && [ -d "$pkg" ]; then
      mkdir -p "$NMDIR/$name"
      for subpkg in "$pkg"/*; do
        subname=$(basename "$subpkg")
        [ ! -e "$NMDIR/$name/$subname" ] && [ -d "$subpkg" ] && cp -a "$subpkg" "$NMDIR/$name/$subname"
      done
    # 일반 패키지
    elif [ ! -e "$NMDIR/$name" ] && [ -d "$pkg" ]; then
      cp -a "$pkg" "$NMDIR/$name"
    fi
  done
fi

echo "=== 3/4: Electron 코드 컴파일 ==="
npx tsc -p desktop/tsconfig.json

PLATFORM="${1:-auto}"

echo "=== 4/4: Electron 앱 빌드 ($PLATFORM) ==="
case "$PLATFORM" in
  mac)
    npx electron-builder --mac
    echo ""; echo "빌드 완료!"; ls -la dist/*.dmg 2>/dev/null
    ;;
  win)
    npx electron-builder --win
    echo ""; echo "빌드 완료!"; ls -la dist/*.exe 2>/dev/null
    ;;
  all)
    npx electron-builder --mac --win
    echo ""; echo "빌드 완료!"; ls -la dist/*.dmg dist/*.exe 2>/dev/null
    ;;
  auto)
    if [[ "$(uname)" == "Darwin" ]]; then
      npx electron-builder --mac
      echo ""; echo "빌드 완료!"; ls -la dist/*.dmg 2>/dev/null
    else
      npx electron-builder --win
      echo ""; echo "빌드 완료!"; ls -la dist/*.exe 2>/dev/null
    fi
    ;;
  *)
    echo "사용법: $0 [mac|win|all|auto]"; exit 1
    ;;
esac
