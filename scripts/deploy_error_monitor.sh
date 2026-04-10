#!/usr/bin/env bash
# 에러 모니터 워크플로우 배포 스크립트
# 사용법: ./scripts/deploy_error_monitor.sh <server>
# 서버명: cloud | gcp-vm | railway
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

check_deps

if [ -z "$1" ]; then
  echo "사용법: $0 <server>"
  echo "서버명: cloud | gcp-vm | railway"
  exit 1
fi

SERVER="$1"
load_server_config "$SERVER"

SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL 환경변수를 .env에 설정하세요}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "에러 모니터 배포 중: $SERVER"
echo "URL: $N8N_URL"

WORKFLOW_JSON=$(python3 -c "
import json, sys

server_url = sys.argv[1]
api_key = sys.argv[2]
server_name = sys.argv[3]
slack_webhook = sys.argv[4]

wf = {
    'name': '\U0001F4CA 에러 모니터 - AI 분석',
    'nodes': [
        {
            'id': 'e1e2f3a4-0001-0001-0001-000000000001',
            'name': '5분마다 실행',
            'type': 'n8n-nodes-base.scheduleTrigger',
            'typeVersion': 1.2,
            'position': [260, 300],
            'parameters': {
                'rule': {
                    'interval': [{'field': 'minutes', 'minutesInterval': 5}]
                }
            }
        },
        {
            'id': 'e1e2f3a4-0002-0002-0002-000000000002',
            'name': '마지막 체크 시간 조회',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [480, 300],
            'parameters': {
                'jsCode': \"const staticData = \\\$getWorkflowStaticData('global');\\nconst lastCheckedAt = staticData.lastCheckedAt || new Date(Date.now() - 5 * 60 * 1000).toISOString();\\nreturn [{ json: { lastCheckedAt } }];\"
            }
        },
        {
            'id': 'e1e2f3a4-0003-0003-0003-000000000003',
            'name': '에러 실행 목록 조회',
            'type': 'n8n-nodes-base.httpRequest',
            'typeVersion': 4.2,
            'position': [700, 300],
            'parameters': {
                'method': 'GET',
                'url': server_url + '/api/v1/executions',
                'sendHeaders': True,
                'headerParameters': {
                    'parameters': [
                        {'name': 'X-N8N-API-KEY', 'value': api_key}
                    ]
                },
                'sendQuery': True,
                'queryParameters': {
                    'parameters': [
                        {'name': 'status', 'value': 'error'},
                        {'name': 'limit', 'value': '10'}
                    ]
                },
                'options': {}
            }
        },
        {
            'id': 'e1e2f3a4-0004-0004-0004-000000000004',
            'name': '신규 에러 필터링',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [920, 300],
            'parameters': {
                'jsCode': (
                    \"const lastCheckedAt = \\\$('마지막 체크 시간 조회').item.json.lastCheckedAt;\\n\"
                    \"const response = \\\$input.item.json;\\n\"
                    \"const executions = response.data || [];\\n\\n\"
                    \"const newErrors = executions.filter(ex => {\\n\"
                    \"  return new Date(ex.startedAt) > new Date(lastCheckedAt);\\n\"
                    \"});\\n\\n\"
                    \"// 체크 시간 업데이트\\n\"
                    \"const staticData = \\\$getWorkflowStaticData('global');\\n\"
                    \"staticData.lastCheckedAt = new Date().toISOString();\\n\\n\"
                    \"if (newErrors.length === 0) {\\n\"
                    \"  return [];\\n\"
                    \"}\\n\\n\"
                    \"// Slack 메시지 포맷팅\\n\"
                    \"const errorLines = newErrors.map(ex => {\\n\"
                    \"  const time = new Date(ex.startedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });\\n\"
                    \"  const msg = ex.stoppedAt ? '실행 실패' : '알 수 없는 에러';\\n\"
                    \"  return '\\\\u2022 워크플로우 ID: ' + ex.workflowId + ' | 시간: ' + time;\\n\"
                    \"}).join('\\\\n');\\n\\n\"
                    \"return [{ json: {\\n\"
                    \"  count: newErrors.length,\\n\"
                    \"  errorLines: errorLines,\\n\"
                    \"  errors: newErrors\\n\"
                    \"} }];\"
                )
            }
        },
        {
            'id': 'e1e2f3a4-0005-0005-0005-000000000005',
            'name': 'Slack 에러 알림 전송',
            'type': 'n8n-nodes-base.httpRequest',
            'typeVersion': 4.2,
            'position': [1140, 300],
            'parameters': {
                'method': 'POST',
                'url': slack_webhook,
                'sendBody': True,
                'specifyBody': 'string',
                'body': (
                    \"={{ JSON.stringify({\"
                    \"text: '\\\\uD83D\\\\uDCCA 에러 모니터 리포트',\"
                    \"blocks: [\"
                    \"{type:'header',text:{type:'plain_text',text:'\\\\uD83D\\\\uDCCA 에러 모니터 리포트'}},\"
                    \"{type:'section',fields:[\"
                    \"{type:'mrkdwn',text:'*서버:*\\\\n\" + server_name + \"'},\"
                    \"{type:'mrkdwn',text:'*새 에러:*\\\\n'+\\\$json.count+'건'}\"
                    \"]},\"
                    \"{type:'section',text:{type:'mrkdwn',text:\\\$json.errorLines}}\"
                    \"]}) }}\"
                ),
                'options': {
                    'response': {
                        'response': {
                            'neverError': True
                        }
                    }
                }
            }
        }
    ],
    'connections': {
        '5분마다 실행': {
            'main': [[{'node': '마지막 체크 시간 조회', 'type': 'main', 'index': 0}]]
        },
        '마지막 체크 시간 조회': {
            'main': [[{'node': '에러 실행 목록 조회', 'type': 'main', 'index': 0}]]
        },
        '에러 실행 목록 조회': {
            'main': [[{'node': '신규 에러 필터링', 'type': 'main', 'index': 0}]]
        },
        '신규 에러 필터링': {
            'main': [[{'node': 'Slack 에러 알림 전송', 'type': 'main', 'index': 0}]]
        }
    },
    'settings': {
        'executionOrder': 'v1'
    }
}

print(json.dumps(wf, ensure_ascii=False))
" "$N8N_URL" "$API_KEY" "$SERVER" "$SLACK_WEBHOOK")

# n8n API로 워크플로우 생성
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-N8N-API-KEY: ${API_KEY}" \
  -d "$WORKFLOW_JSON" \
  "${N8N_URL}/api/v1/workflows")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  WF_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','unknown'))" 2>/dev/null || echo "unknown")
  echo "✅ 생성 성공! 워크플로우 ID: $WF_ID"

  # 워크플로우 활성화
  ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "X-N8N-API-KEY: ${API_KEY}" \
    "${N8N_URL}/api/v1/workflows/${WF_ID}/activate")
  ACTIVATE_CODE=$(echo "$ACTIVATE_RESPONSE" | tail -1)
  if [ "$ACTIVATE_CODE" -ge 200 ] && [ "$ACTIVATE_CODE" -lt 300 ]; then
    echo "✅ 활성화 완료!"
  else
    echo "⚠️  활성화 실패 (HTTP $ACTIVATE_CODE) - 수동으로 활성화 해주세요"
  fi
else
  echo "❌ 실패 (HTTP $HTTP_CODE)"
  echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2, ensure_ascii=False))" 2>/dev/null || echo "$BODY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "배포 완료! 5분마다 에러를 감지하여 Slack으로 알림을 전송합니다."
