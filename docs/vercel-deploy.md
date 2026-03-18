# Admin 대시보드 Vercel 배포 가이드

## 방법 1: Deploy to Vercel 버튼 (권장)

README의 "Deploy with Vercel" 버튼을 클릭하면 자동으로 진행됩니다.

1. 버튼 클릭 → Vercel 로그인
2. 레포를 내 GitHub 계정으로 fork
3. 환경변수 입력 폼이 표시됩니다:
   - `APP_NAME`: 대시보드 이름 (예: My n8n Admin)
   - `SERVER_NAME`: 서버 이름 (예: My Server)
   - `SERVER_URL`: n8n 서버 URL (예: https://n8n.example.com)
   - `SERVER_API_KEY`: n8n API 키
   - `ADMIN_PASSWORD`: 대시보드 로그인 비밀번호
   - `NEXTAUTH_SECRET`: 랜덤 문자열 (`openssl rand -base64 32`로 생성)
   - `NEXTAUTH_URL`: **배포 후 Vercel이 제공하는 URL로 반드시 변경** (아래 주의사항 참고)
4. Deploy 클릭 → 배포 완료

## 방법 2: 수동 배포

```bash
cd n8n-admin/admin
pnpm install
pnpm build
# Vercel CLI로 배포
npx vercel --prod
```

## ⚠️ NEXTAUTH_URL 주의사항

Vercel 배포 후 `NEXTAUTH_URL`을 실제 배포 URL로 업데이트하지 않으면 **로그인이 작동하지 않습니다**.

1. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
2. `NEXTAUTH_URL`을 실제 배포 URL로 변경
   - 예) `https://n8n-admin-yourname.vercel.app`
   - 커스텀 도메인 사용 시: `https://admin.example.com`
3. Redeploy (변경사항 적용)

## 서버 추가 (배포 후)

Vercel 대시보드 → Environment Variables에서 추가:
- `SERVER2_NAME`, `SERVER2_URL`, `SERVER2_API_KEY`

추가 후 Redeploy하면 대시보드에 새 서버 탭이 나타납니다.
