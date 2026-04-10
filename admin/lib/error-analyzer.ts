/**
 * n8n 워크플로우 에러 분석 모듈
 *
 * - 실행 에러를 Gemini AI로 분석하여 카테고리, 원인, 해결 방법 제안
 * - 에러 요약 리포트 생성
 */

import { ServerConfig, N8nExecution } from './types'
import { listExecutions, getExecution } from './n8n-client'

// ─── 타입 정의 ──────────────────────────────────────────────────

export interface ErrorAnalysis {
  executionId: string
  workflowId: string
  workflowName?: string
  errorMessage: string
  category: 'credential' | 'network' | 'data' | 'logic' | 'timeout' | 'unknown'
  rootCause: string
  suggestedFix: string
  autoFixable: boolean
}

export interface ErrorSummary {
  server: string
  period: string
  totalErrors: number
  analyses: ErrorAnalysis[]
  topCategories: { category: string; count: number }[]
}

// ─── Gemini API ──────────────────────────────────────────────────

export async function analyzeError(
  geminiApiKey: string,
  errorData: { workflowName: string; errorMessage: string; nodeType?: string }
): Promise<{ category: string; rootCause: string; suggestedFix: string; autoFixable: boolean }> {
  const prompt = `다음 n8n 워크플로우 에러를 분석해주세요:
워크플로우: ${errorData.workflowName}
에러: ${errorData.errorMessage}
노드 타입: ${errorData.nodeType ?? '알 수 없음'}

다음 형식의 JSON으로 답변해주세요:
{"category": "credential|network|data|logic|timeout|unknown", "rootCause": "원인 설명", "suggestedFix": "해결 방법", "autoFixable": true/false}`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 200, temperature: 0.2 },
    }),
  })

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  // JSON 추출: 코드 블록 또는 직접 JSON 파싱
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { category: 'unknown', rootCause: '분석 실패', suggestedFix: '수동 확인 필요', autoFixable: false }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      category: parsed.category ?? 'unknown',
      rootCause: parsed.rootCause ?? '알 수 없음',
      suggestedFix: parsed.suggestedFix ?? '수동 확인 필요',
      autoFixable: parsed.autoFixable ?? false,
    }
  } catch {
    return { category: 'unknown', rootCause: '분석 실패', suggestedFix: '수동 확인 필요', autoFixable: false }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── 에러 메시지 추출 ──────────────────────────────────────────

function extractErrorMessage(execution: N8nExecution): string {
  const data = execution.data as Record<string, unknown> | undefined
  if (!data) return '알 수 없는 에러'

  // n8n execution data 구조에서 에러 메시지 추출
  const resultData = data.resultData as Record<string, unknown> | undefined
  if (resultData?.error) {
    const error = resultData.error as Record<string, unknown>
    return (error.message as string) ?? String(resultData.error)
  }

  // runData에서 마지막 실패 노드 찾기
  const runData = resultData?.runData as Record<string, unknown[]> | undefined
  if (runData) {
    for (const [, nodeRuns] of Object.entries(runData)) {
      for (const run of nodeRuns as Record<string, unknown>[]) {
        if (run.error) {
          const error = run.error as Record<string, unknown>
          return (error.message as string) ?? String(run.error)
        }
      }
    }
  }

  return '알 수 없는 에러'
}

function extractFailedNodeType(execution: N8nExecution): string | undefined {
  const data = execution.data as Record<string, unknown> | undefined
  if (!data) return undefined

  const resultData = data.resultData as Record<string, unknown> | undefined
  const lastNodeExecuted = resultData?.lastNodeExecuted as string | undefined

  if (!lastNodeExecuted) return undefined

  // runData에서 노드 타입 찾기
  const runData = resultData?.runData as Record<string, unknown[]> | undefined
  if (runData?.[lastNodeExecuted]) {
    const nodeRuns = runData[lastNodeExecuted] as Record<string, unknown>[]
    for (const run of nodeRuns) {
      const source = run.source as Record<string, unknown>[] | undefined
      if (source?.[0]) {
        return (source[0] as Record<string, unknown>).previousNodeType as string | undefined
      }
    }
  }

  return lastNodeExecuted
}

// ─── 메인 함수 ──────────────────────────────────────────────────

export async function getErrorSummary(
  server: ServerConfig,
  geminiApiKey: string,
  hours: number = 24
): Promise<ErrorSummary> {
  // 1. 에러 실행 목록 조회
  const executions = await listExecutions(server, { status: 'error', limit: 50 })

  // 시간 범위 필터링
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  const recentErrors = executions.filter((e) => e.startedAt >= cutoff)

  const analyses: ErrorAnalysis[] = []

  // 2. 각 에러를 Gemini로 분석 (rate limit 대응: 2s 간격)
  for (let i = 0; i < recentErrors.length; i++) {
    const exec = recentErrors[i]

    try {
      // 상세 실행 데이터 조회
      const fullExec = await getExecution(server, exec.id)
      const errorMessage = extractErrorMessage(fullExec)
      const nodeType = extractFailedNodeType(fullExec)

      if (i > 0) await sleep(2000)

      const analysis = await analyzeError(geminiApiKey, {
        workflowName: exec.workflowId,
        errorMessage,
        nodeType,
      })

      analyses.push({
        executionId: exec.id,
        workflowId: exec.workflowId,
        errorMessage,
        category: analysis.category as ErrorAnalysis['category'],
        rootCause: analysis.rootCause,
        suggestedFix: analysis.suggestedFix,
        autoFixable: analysis.autoFixable,
      })
    } catch (err) {
      analyses.push({
        executionId: exec.id,
        workflowId: exec.workflowId,
        errorMessage: String(err),
        category: 'unknown',
        rootCause: '분석 중 오류 발생',
        suggestedFix: '수동 확인 필요',
        autoFixable: false,
      })
    }
  }

  // 3. 카테고리별 집계
  const categoryMap = new Map<string, number>()
  for (const a of analyses) {
    categoryMap.set(a.category, (categoryMap.get(a.category) ?? 0) + 1)
  }
  const topCategories = Array.from(categoryMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  return {
    server: server.id,
    period: `최근 ${hours}시간`,
    totalErrors: recentErrors.length,
    analyses,
    topCategories,
  }
}
