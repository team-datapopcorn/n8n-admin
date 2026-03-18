# GCP VM 관리 기능 설정 가이드

GCP(Google Cloud Platform) VM에 n8n을 설치한 경우, Admin 대시보드와 `gcp-vm.sh`로 VM을 제어할 수 있습니다.

## 사전 요구사항

- Google Cloud 계정 및 프로젝트
- n8n이 설치된 GCP VM 인스턴스
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) 설치 (scripts 사용 시)

## 1. GCP 서비스 계정 생성 (Admin 대시보드용)

Vercel에서 GCP VM을 제어하려면 서비스 계정 키가 필요합니다.

1. GCP 콘솔 → IAM & Admin → Service Accounts → Create Service Account
2. 역할(Role): `Compute Instance Admin (v1)` 부여
3. Keys 탭 → Add Key → JSON → 다운로드
4. Vercel 환경변수에 추가:
   - `GCP_SERVICE_ACCOUNT_KEY`: JSON 파일 내용 전체를 붙여넣기

## 2. `.env` 설정

```bash
GCP_PROJECT_ID=your-project-id       # GCP 프로젝트 ID
GCP_INSTANCE_NAME=your-instance      # VM 인스턴스 이름
GCP_ZONE=asia-northeast3-a           # VM 존 (예: us-central1-a)
```

## 3. gcloud CLI 인증 (scripts 사용 시)

```bash
gcloud auth login
gcloud config set project your-project-id
```

## 4. 동작 확인

```bash
# Admin 대시보드: GCP VM 탭이 표시되는지 확인
# Scripts:
./scripts/gcp-vm.sh status
```

## `gcp-vm.sh` 명령어

| 명령어 | 설명 |
|--------|------|
| `./scripts/gcp-vm.sh status` | VM 상태 확인 |
| `./scripts/gcp-vm.sh start` | VM 시작 |
| `./scripts/gcp-vm.sh stop` | VM 중지 |
| `./scripts/gcp-vm.sh restart` | VM 재시작 |
| `./scripts/gcp-vm.sh resize e2-standard-2` | 머신 타입 변경 |
| `./scripts/gcp-vm.sh ssh` | SSH 접속 |
