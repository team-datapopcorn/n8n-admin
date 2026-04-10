/**
 * n8n 워크플로우 네이밍 컨벤션 모듈
 *
 * 컨벤션 패턴: [프로젝트명] 기능 설명
 * 예: [인프런] Slack 알림 자동 발송, [FastCampus] GitHub 이슈 동기화
 */

// ─── 컨벤션 패턴 ──────────────────────────────────────────────

const CONVENTION_PATTERN = /^\[([^\]]+)\]\s+(.+)$/

const COPY_VERSION_PATTERN =
  /\(copy\)|\bcopy\b\s*\d*$|\s*v\d+(\.\d+)*$|\s*mk\d+$/i

const DEFAULT_NAME_PATTERN =
  /^(my\s+)?(workflow|sub-workflow)(\s+\d+)?$/i

// ─── 공개 함수 ──────────────────────────────────────────────

/**
 * 컨벤션에 맞는 워크플로우 이름 생성
 */
export function formatWorkflowName(project: string, description: string): string {
  return `[${project}] ${description}`
}

/**
 * 워크플로우 이름에서 프로젝트 태그와 설명 추출
 */
export function parseWorkflowName(name: string): { project?: string; description: string } {
  const match = name.match(CONVENTION_PATTERN)
  if (match) {
    return { project: match[1], description: match[2] }
  }
  return { description: name.trim() }
}

/**
 * 워크플로우 이름이 컨벤션을 준수하는지 검사
 */
export function validateName(name: string): { valid: boolean; issues: string[] } {
  const issues: string[] = []
  const trimmed = name.trim()

  // 1. 프로젝트 태그 확인
  if (!CONVENTION_PATTERN.test(trimmed)) {
    issues.push('프로젝트 태그 없음 — [프로젝트명] 접두사가 필요합니다')
  }

  // 2. 설명 확인
  const parsed = parseWorkflowName(trimmed)
  if (parsed.project && !parsed.description) {
    issues.push('설명 없음 — 프로젝트 태그 뒤에 기능 설명이 필요합니다')
  }

  // 3. 복사/버전 마커 확인
  if (COPY_VERSION_PATTERN.test(trimmed)) {
    issues.push('복사/버전 마커 포함 — (copy), v1, mk2 등을 제거하세요')
  }

  // 4. 기본 이름 확인
  if (DEFAULT_NAME_PATTERN.test(trimmed)) {
    issues.push('기본 이름 사용 — 의미 있는 이름으로 변경하세요')
  }

  return { valid: issues.length === 0, issues }
}

/**
 * 컨벤션 준수 여부 빠른 확인
 */
export function isConventionCompliant(name: string): boolean {
  return validateName(name).valid
}

/**
 * 워크플로우 배열에서 네이밍 컨벤션 위반 목록 추출
 */
export function getViolations(
  workflows: { id: string; name: string; active: boolean }[]
): { id: string; name: string; active: boolean; issues: string[]; suggestedName: string }[] {
  return workflows
    .map((w) => {
      const { valid, issues } = validateName(w.name)
      if (valid) return null
      return {
        id: w.id,
        name: w.name,
        active: w.active,
        issues,
        suggestedName: DEFAULT_NAME_PATTERN.test(w.name.trim()) ? '' : suggestFix(w.name),
      }
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
}

/**
 * 컨벤션 위반 이름에 대한 수정 제안 생성
 */
export function suggestFix(name: string): string {
  let cleaned = name.trim()

  // 복사/버전 마커 제거
  cleaned = cleaned.replace(/^\(Copy\)\s*/i, '')
  cleaned = cleaned.replace(/\s*\(copy\)\s*\d*/gi, '')
  cleaned = cleaned.replace(/\s+copy\s*\d*$/gi, '')
  cleaned = cleaned.replace(/\s*v\d+(\.\d+)*$/g, '')
  cleaned = cleaned.replace(/\s*mk\d+$/g, '')
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, '')
  cleaned = cleaned.trim()

  // 이미 컨벤션에 맞으면 그대로 반환
  if (CONVENTION_PATTERN.test(cleaned)) {
    return cleaned
  }

  // 프로젝트 태그가 없으면 [미분류] 추가
  const description = cleaned || '미분류 워크플로우'
  return formatWorkflowName('미분류', description)
}
