/**
 * n8n 워크플로우 자동 정리 모듈
 *
 * - 기본 이름(workflow, My workflow N) → Gemini AI가 노드 내용 기반으로 한국어 이름 제안
 * - 복사/버전 마커((copy), v1, mk2 등) → 정규화 제거
 * - 크레덴셜 이상 이름은 보고서에만 기록 (자동 변경 불가)
 *
 * 정규화 규칙: scripts/cleanup-workflows.sh 의 Python 로직 포팅
 */

import { ServerConfig, N8nWorkflow, N8nCredential } from './types'
import { listWorkflows, getWorkflow, updateWorkflow, listCredentials } from './n8n-client'
import { validateName, suggestFix } from './naming-convention'

// ─── 이름 분류 함수 ──────────────────────────────────────────────

export function isDefaultName(name: string): boolean {
  return /^(my\s+)?(workflow|sub-workflow)(\s+\d+)?$/i.test(name.trim())
}

export function isCopyOrVersion(name: string): boolean {
  const lower = name.toLowerCase()
  return (
    lower.includes('(copy)') ||
    /\bcopy\b/i.test(name) ||
    /\s*v\d+(\.\d+)*$/i.test(name) ||
    /\s*mk\d+$/i.test(name)
  )
}

export function isAbnormalCredentialName(name: string): boolean {
  return isDefaultName(name) || isCopyOrVersion(name) || /^(test|temp|임시|테스트)/i.test(name.trim())
}

export function cleanName(name: string): string {
  let n = name
  n = n.replace(/^\(Copy\)\s*/i, '')
  n = n.replace(/\s*\(copy\)\s*\d*/gi, '')
  n = n.replace(/\s+copy\s*\d*$/gi, '')
  n = n.replace(/\s*v\d+(\.\d+)*$/g, '')
  n = n.replace(/\s*mk\d+$/g, '')
  n = n.replace(/^\d+[\s_-]*/g, '')
  n = n.replace(/\s*\([^)]*\)/g, '')
  return n.trim()
}

// ─── Gemini API ──────────────────────────────────────────────────

async function askGemini(apiKey: string, nodeTypes: string[], currentName: string): Promise<string> {
  const prompt = `다음은 n8n 자동화 워크플로우의 노드 목록입니다:
${nodeTypes.slice(0, 20).join(', ')}

이 워크플로우의 이름을 아래 컨벤션에 맞게 1개만 제안해주세요.

컨벤션: [프로젝트명] 기능 설명
- 프로젝트명: 워크플로우가 연동하는 주요 서비스 또는 업무 도메인 (예: Slack, GitHub, Notion, 인사, 정산)
- 기능 설명: 동사+목적어 형식, 최대 15자
- 전체 최대 25자
- 예시: "[Slack] 알림 자동 발송", "[GitHub] 이슈 Notion 동기화", "[인사] 입퇴사 처리 알림"
- 이름만 출력, 설명 없이`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 50, temperature: 0.3 },
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const cleaned = text.trim().replace(/^["'\s]+|["'\s]+$/g, '')
  return cleaned.length > 0 ? cleaned.slice(0, 20) : cleanName(currentName) || '미분류 워크플로우'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── 메인 실행 ──────────────────────────────────────────────────

export interface CleanupResult {
  renamed: { id: string; oldName: string; newName: string; method: 'ai' | 'normalize' }[]
  skipped: { id: string; name: string; reason: string }[]
  credentialWarnings: { id: string; name: string; type: string }[]
  errors: { id: string; name: string; error: string }[]
  conventionViolations: { id: string; name: string; issues: string[] }[]
}

export async function runAutoCleanup(
  server: ServerConfig,
  geminiApiKey: string,
  dryRun = false,
): Promise<CleanupResult> {
  const result: CleanupResult = { renamed: [], skipped: [], credentialWarnings: [], errors: [], conventionViolations: [] }

  // 1. 전체 워크플로우 + 크레덴셜 가져오기 (크레덴셜은 403 등 실패 시 빈 배열)
  const [workflows, credentials] = await Promise.all([
    listWorkflows(server),
    listCredentials(server).catch(() => []),
  ])

  // 2. 크레덴셜 이상 이름 보고 (변경 없음)
  for (const cred of credentials as N8nCredential[]) {
    if (isAbnormalCredentialName(cred.name)) {
      result.credentialWarnings.push({ id: cred.id, name: cred.name, type: cred.type })
    }
  }

  // 3. 컨벤션 위반 워크플로우 분류
  const aiCandidates: N8nWorkflow[] = []
  const suggestCandidates: { wf: N8nWorkflow; newName: string }[] = []

  for (const wf of workflows as N8nWorkflow[]) {
    const { valid } = validateName(wf.name)
    if (valid) {
      result.skipped.push({ id: wf.id, name: wf.name, reason: '컨벤션 준수' })
      continue
    }
    if (isDefaultName(wf.name)) {
      // 기본 이름(My workflow N 등) → Gemini로 [프로젝트명] 기능 설명 생성
      aiCandidates.push(wf)
    } else {
      // 그 외 위반 → 화면 제안과 동일한 suggestFix() 적용
      const newName = suggestFix(wf.name)
      if (newName && newName !== wf.name) {
        suggestCandidates.push({ wf, newName })
      } else {
        result.skipped.push({ id: wf.id, name: wf.name, reason: '제안 이름 동일' })
      }
    }
  }

  // 4. [A] 기본 이름 → Gemini AI로 [프로젝트명] 기능 설명 생성 (4s 간격)
  for (let i = 0; i < aiCandidates.length; i++) {
    const wf = aiCandidates[i]
    try {
      const fullWf = await getWorkflow(server, wf.id)
      const nodeTypes = (fullWf.nodes as { type?: string }[] ?? [])
        .map((n) => n.type ?? '')
        .filter(Boolean)

      if (i > 0) await sleep(4000)

      const newName = await askGemini(geminiApiKey, nodeTypes, wf.name)

      if (dryRun) {
        result.renamed.push({ id: wf.id, oldName: wf.name, newName, method: 'ai' })
      } else {
        await updateWorkflow(server, wf.id, { ...fullWf, name: newName })
        result.renamed.push({ id: wf.id, oldName: wf.name, newName, method: 'ai' })
      }
    } catch (err) {
      result.errors.push({ id: wf.id, name: wf.name, error: String(err) })
    }
  }

  // 5. [B] 그 외 위반 → 화면 제안(suggestFix) 그대로 적용
  for (const { wf, newName } of suggestCandidates) {
    try {
      if (dryRun) {
        result.renamed.push({ id: wf.id, oldName: wf.name, newName, method: 'normalize' })
      } else {
        const fullWf = await getWorkflow(server, wf.id)
        await updateWorkflow(server, wf.id, { ...fullWf, name: newName })
        result.renamed.push({ id: wf.id, oldName: wf.name, newName, method: 'normalize' })
      }
    } catch (err) {
      result.errors.push({ id: wf.id, name: wf.name, error: String(err) })
    }
  }

  // 6. 컨벤션 검사 — 모든 워크플로우(변경된 이름 포함)에 대해 검사
  const renamedMap = new Map(result.renamed.map((r) => [r.id, r.newName]))
  for (const wf of workflows as N8nWorkflow[]) {
    const currentName = renamedMap.get(wf.id) ?? wf.name
    const validation = validateName(currentName)
    if (!validation.valid) {
      result.conventionViolations.push({ id: wf.id, name: currentName, issues: validation.issues })
    }
  }

  return result
}
