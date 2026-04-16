/**
 * Slack Webhook 알림 모듈
 */

import { CleanupResult } from './auto-cleanup'

interface ServerResult {
  serverId: string
  serverName: string
  renamed?: CleanupResult['renamed']
  errors?: CleanupResult['errors']
  skipped?: CleanupResult['skipped']
  credentialWarnings?: CleanupResult['credentialWarnings']
  error?: string
}

export async function sendSlackCleanupReport(
  webhookUrl: string,
  results: ServerResult[],
  triggeredBy: 'cron' | 'manual' = 'cron',
) {
  const totalRenamed = results.reduce((sum, r) => sum + (r.renamed?.length ?? 0), 0)
  const totalErrors = results.reduce((sum, r) => sum + (r.errors?.length ?? 0) + (r.error ? 1 : 0), 0)

  const kstTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const triggerLabel = triggeredBy === 'cron' ? '자동 실행 (Cron)' : '수동 실행'

  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: totalErrors > 0 ? '⚠️ n8n 워크플로우 자동 정리 완료 (오류 있음)' : '✅ n8n 워크플로우 자동 정리 완료',
      },
    },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: `${kstTime} · ${triggerLabel}` },
      ],
    },
    { type: 'divider' },
  ]

  for (const r of results) {
    if (r.error) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${r.serverName}* (${r.serverId})\n❌ 서버 오류: ${r.error}`,
        },
      })
      continue
    }

    const aiRenamed = r.renamed?.filter((x) => x.method === 'ai') ?? []
    const normRenamed = r.renamed?.filter((x) => x.method === 'normalize') ?? []

    let text = `*${r.serverName}* (${r.serverId})\n`
    text += `이름 변경: ${r.renamed?.length ?? 0}개 (AI: ${aiRenamed.length}, 정규화: ${normRenamed.length})`

    if (r.errors?.length) {
      text += `\n⚠️ 오류: ${r.errors.length}개`
    }

    blocks.push({ type: 'section', text: { type: 'mrkdwn', text } })

    // 변경 상세 (최대 10개)
    const renamedList = r.renamed?.slice(0, 10) ?? []
    if (renamedList.length > 0) {
      const lines = renamedList.map(
        (item) => `• ~${item.oldName}~ → *${item.newName}* _[${item.method === 'ai' ? 'AI' : '정규화'}]_`,
      )
      if ((r.renamed?.length ?? 0) > 10) {
        lines.push(`• _외 ${(r.renamed?.length ?? 0) - 10}개 더..._`)
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: lines.join('\n') },
      })
    }
  }

  // 최종 요약
  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*요약:* 총 ${totalRenamed}개 이름 변경` + (totalErrors > 0 ? ` | ⚠️ 오류 ${totalErrors}건` : ''),
    },
  })

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blocks }),
  })
}

export async function sendSlackError(webhookUrl: string, message: string) {
  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `❌ n8n Admin Cron 오류\n${message}`,
    }),
  })
}
