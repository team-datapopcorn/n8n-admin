# n8n Admin 셋업 스크립트 (Windows PowerShell)
# 사용법: .\setup.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot
$EnvFile = Join-Path $RepoRoot ".env"

Write-Host "=== n8n Admin 셋업 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 필수 도구 확인
Write-Host "--- 필수 도구 확인 ---"
$Missing = @()
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $Missing += "Node.js (https://nodejs.org)" }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { $Missing += "pnpm (npm install -g pnpm)" }

if ($Missing.Count -gt 0) {
    Write-Host "다음 도구가 필요합니다:" -ForegroundColor Red
    foreach ($tool in $Missing) { Write-Host "  - $tool" }
    exit 1
}

$NodeVer = [int]((node -v) -replace 'v' -split '\.')[0]
if ($NodeVer -lt 18) {
    Write-Host "Node.js 18 이상이 필요합니다. 현재: $(node -v)" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js $(node -v), pnpm $(pnpm -v) 확인 완료" -ForegroundColor Green

# 2. 의존성 설치
Write-Host ""
Write-Host "--- 의존성 설치 ---"
Push-Location admin; pnpm install; Pop-Location
npm install
Write-Host "의존성 설치 완료" -ForegroundColor Green

# 3. .env 파일 생성
Write-Host ""
Write-Host "--- 서버 설정 ---"
$SkipEnv = $false
if (Test-Path $EnvFile) {
    $Overwrite = Read-Host ".env 파일이 이미 있습니다. 덮어쓸까요? (y/N)"
    if ($Overwrite -ne "y") { $SkipEnv = $true; Write-Host ".env 파일을 유지합니다." }
}

if (-not $SkipEnv) {
    $ServerName = Read-Host "서버 이름 (기본: My n8n Server)"
    if ([string]::IsNullOrWhiteSpace($ServerName)) { $ServerName = "My n8n Server" }

    $ServerUrl = Read-Host "n8n 서버 URL (예: https://your-n8n.com)"
    $ServerUrl = $ServerUrl.TrimEnd('/')

    Write-Host "연결 테스트 중..."
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/v1/workflows?limit=1" -TimeoutSec 5 -UseBasicParsing
        Write-Host "서버 응답 확인 (HTTP $($response.StatusCode))" -ForegroundColor Green
    } catch {
        Write-Host "경고: 서버에 연결할 수 없습니다." -ForegroundColor Yellow
        $Continue = Read-Host "계속 진행할까요? (y/N)"
        if ($Continue -ne "y") { exit 1 }
    }

    $ApiKey = Read-Host "n8n API 키"

    Write-Host "API 키 검증 중..."
    try {
        $headers = @{ "X-N8N-API-KEY" = $ApiKey; "Accept" = "application/json" }
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/v1/workflows?limit=1" -Headers $headers -TimeoutSec 5 -UseBasicParsing
        Write-Host "API 키 검증 성공!" -ForegroundColor Green
    } catch {
        Write-Host "경고: API 키 검증 실패. n8n -> Settings -> API에서 키를 확인해주세요." -ForegroundColor Yellow
        $Continue = Read-Host "계속 진행할까요? (y/N)"
        if ($Continue -ne "y") { exit 1 }
    }

    $AdminPassword = Read-Host "관리자 비밀번호 (기본: admin1234)"
    if ([string]::IsNullOrWhiteSpace($AdminPassword)) { $AdminPassword = "admin1234" }

    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $NextAuthSecret = [Convert]::ToBase64String($bytes)

    @"
APP_NAME="n8n Admin"

SERVER_NAME="$ServerName"
SERVER_URL=$ServerUrl
SERVER_API_KEY=$ApiKey

ADMIN_PASSWORD=$AdminPassword
NEXTAUTH_SECRET=$NextAuthSecret
NEXTAUTH_URL=http://localhost:3000
"@ | Set-Content -Path $EnvFile -Encoding UTF8

    Write-Host ".env 파일 생성 완료" -ForegroundColor Green
}

# 4. Claude Code 연결
Write-Host ""
Write-Host "--- Claude Code 연결 ---"
if (Get-Command claude -ErrorAction SilentlyContinue) {
    Write-Host "Claude Code 감지됨" -ForegroundColor Green
    Write-Host "프로젝트 폴더에서 'claude'를 실행하면 n8n 스킬이 자동 로드됩니다."
} else {
    Write-Host "Claude Code가 설치되어 있지 않습니다."
    Write-Host "설치: npm install -g @anthropic-ai/claude-code"
    Write-Host "(선택 사항 - n8n-admin 대시보드는 Claude Code 없이도 사용 가능합니다)"
}

# 5. 완료
Write-Host ""
Write-Host "=== 셋업 완료! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:"
Write-Host "  1. 웹 대시보드 실행:  cd admin; pnpm dev"
Write-Host "  2. 브라우저에서 열기:  http://localhost:3000"
Write-Host "  3. Claude Code 실행:  claude  (프로젝트 루트에서)"
Write-Host ""
