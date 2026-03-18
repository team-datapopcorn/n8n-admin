#!/bin/bash
# GCP VM 인스턴스 관리 스크립트
#
# 사용법: ./scripts/gcp-vm.sh <명령어> [옵션]
#
# 명령어:
#   status              현재 VM 상태 확인
#   start               VM 시작
#   stop                VM 중지 (n8n 서비스 중단됨)
#   restart             VM 재시작
#   resize <머신타입>   머신 타입 변경 (VM 자동 중지 후 변경 후 재시작)
#   ssh                 VM에 SSH 접속
#
# 머신 타입 예시:
#   e2-micro    (1 vCPU, 1GB)   무료 티어
#   e2-small    (2 vCPU, 2GB)
#   e2-medium   (2 vCPU, 4GB)  현재 사용 중
#   e2-standard-2 (2 vCPU, 8GB)
#   e2-standard-4 (4 vCPU, 16GB)
#   n2-standard-2 (2 vCPU, 8GB)
#
# 설정: .env 파일에 GCP_PROJECT_ID, GCP_INSTANCE_NAME, GCP_ZONE 필요

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env"

# GCP VM 기능은 .env에 GCP_PROJECT_ID가 설정된 경우에만 사용할 수 있습니다.
if [ -z "${GCP_PROJECT_ID:-}" ]; then
  echo "GCP VM 관리 기능을 사용하려면 .env에 GCP 설정이 필요합니다."
  echo "자세한 내용: docs/gcp-setup.md"
  exit 1
fi

# gcloud PATH 설정 (brew 설치 경로)
export PATH=/opt/homebrew/share/google-cloud-sdk/bin:"$PATH"

# 의존성 확인
if ! command -v gcloud &> /dev/null; then
  echo "오류: gcloud CLI가 설치되어 있지 않습니다."
  echo "설치: brew install --cask google-cloud-sdk"
  echo "인증: gcloud auth login"
  exit 1
fi

# GCP 설정 확인 (_common.sh에서 .env는 이미 로드됨)
PROJECT="${GCP_PROJECT_ID:-}"
INSTANCE="${GCP_INSTANCE_NAME:-}"
ZONE="${GCP_ZONE:-}"

if [ -z "$INSTANCE" ] || [ -z "$ZONE" ]; then
  echo "오류: .env 파일에 GCP_INSTANCE_NAME, GCP_ZONE을 설정하세요."
  exit 1
fi

GCLOUD="gcloud compute instances --project=$PROJECT"
CMD="${1:-}"

case "$CMD" in

  status)
    echo "[GCP VM] 인스턴스 상태 조회 중..."
    $GCLOUD describe "$INSTANCE" --zone="$ZONE" \
      --format="table(name, status, machineType.basename(), networkInterfaces[0].accessConfigs[0].natIP:label=EXTERNAL_IP, lastStartTimestamp)"
    ;;

  start)
    echo "[GCP VM] 인스턴스 시작 중..."
    $GCLOUD start "$INSTANCE" --zone="$ZONE"
    echo ""
    echo "완료: VM이 시작되었습니다."
    echo "n8n이 완전히 뜨기까지 1-2분 소요될 수 있습니다."
    echo "접속: .env의 SERVER_URL을 확인하세요."
    ;;

  stop)
    echo "[GCP VM] 인스턴스를 중지하면 n8n 서비스가 중단됩니다."
    read -p "계속하시겠습니까? (yes 입력): " CONFIRM
    [ "$CONFIRM" != "yes" ] && { echo "취소되었습니다."; exit 0; }

    echo "인스턴스 중지 중..."
    $GCLOUD stop "$INSTANCE" --zone="$ZONE"
    echo "완료: VM이 중지되었습니다."
    ;;

  restart)
    echo "[GCP VM] 인스턴스 재시작 중..."
    $GCLOUD reset "$INSTANCE" --zone="$ZONE"
    echo ""
    echo "완료: VM이 재시작되었습니다."
    echo "n8n이 완전히 뜨기까지 1-2분 소요될 수 있습니다."
    ;;

  resize)
    NEW_TYPE="${2:-}"
    if [ -z "$NEW_TYPE" ]; then
      echo "사용법: $0 resize <머신타입>"
      echo ""
      echo "머신 타입 예시:"
      echo "  e2-micro        (1 vCPU, 1GB RAM)   - 무료 티어"
      echo "  e2-small        (2 vCPU, 2GB RAM)"
      echo "  e2-medium       (2 vCPU, 4GB RAM)   - 현재"
      echo "  e2-standard-2   (2 vCPU, 8GB RAM)"
      echo "  e2-standard-4   (4 vCPU, 16GB RAM)"
      echo ""
      echo "현재 머신 타입 확인: $0 status"
      exit 1
    fi

    # 현재 상태 확인
    CURRENT_STATUS=$($GCLOUD describe "$INSTANCE" --zone="$ZONE" --format="value(status)")
    CURRENT_TYPE=$($GCLOUD describe "$INSTANCE" --zone="$ZONE" --format="value(machineType.basename())")

    echo "[GCP VM] 머신 타입 변경"
    echo "  현재: $CURRENT_TYPE (상태: $CURRENT_STATUS)"
    echo "  변경: $NEW_TYPE"
    echo ""
    echo "주의: 머신 타입 변경 시 VM이 중지되고 재시작됩니다 (n8n 서비스 중단)."
    read -p "계속하시겠습니까? (yes 입력): " CONFIRM
    [ "$CONFIRM" != "yes" ] && { echo "취소되었습니다."; exit 0; }

    # 실행 중이면 중지
    if [ "$CURRENT_STATUS" = "RUNNING" ]; then
      echo "VM 중지 중..."
      $GCLOUD stop "$INSTANCE" --zone="$ZONE"
    fi

    # 머신 타입 변경
    echo "머신 타입 변경 중: $CURRENT_TYPE → $NEW_TYPE"
    $GCLOUD set-machine-type "$INSTANCE" \
      --zone="$ZONE" \
      --machine-type="$NEW_TYPE"

    # 재시작
    echo "VM 재시작 중..."
    $GCLOUD start "$INSTANCE" --zone="$ZONE"

    echo ""
    echo "완료: 머신 타입이 $NEW_TYPE 으로 변경되었습니다."
    echo "n8n이 완전히 뜨기까지 1-2분 소요될 수 있습니다."
    ;;

  ssh)
    echo "[GCP VM] SSH 접속..."
    gcloud compute ssh "$INSTANCE" --zone="$ZONE" --project="$PROJECT"
    ;;

  *)
    echo "GCP VM 관리 스크립트"
    echo ""
    echo "사용법: $0 <명령어>"
    echo ""
    echo "명령어:"
    echo "  status              VM 상태 확인"
    echo "  start               VM 시작"
    echo "  stop                VM 중지 (n8n 서비스 중단)"
    echo "  restart             VM 재시작"
    echo "  resize <머신타입>   머신 타입 변경"
    echo "  ssh                 SSH 접속"
    echo ""
    echo "머신 타입:"
    echo "  e2-micro        1 vCPU, 1GB"
    echo "  e2-small        2 vCPU, 2GB"
    echo "  e2-medium       2 vCPU, 4GB  ← 현재"
    echo "  e2-standard-2   2 vCPU, 8GB"
    echo "  e2-standard-4   4 vCPU, 16GB"
    exit 1
    ;;
esac
