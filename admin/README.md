# n8n Admin 대시보드

n8n 서버를 위한 웹 관리 대시보드입니다.

## 로컬 개발 빠른 시작

```bash
# 1. admin 디렉토리로 이동
cd admin

# 2. 환경변수 설정
cp .env.example .env.local
# .env.local을 열어 SERVER_URL, SERVER_API_KEY, ADMIN_PASSWORD 입력

# 3. 의존성 설치
pnpm install

# 4. 개발 서버 실행
pnpm dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열고 `.env.local`에 설정한 비밀번호로 로그인하세요.

## Vercel 배포

[docs/vercel-deploy.md](../docs/vercel-deploy.md) 참고
