#!/usr/bin/env bash
# 에러 핸들러 워크플로우 배포 스크립트
# 사용법: ./scripts/deploy_error_handler.sh <server>
# 서버명: cloud | gcp-vm | railway | raspberry-pi
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_common.sh"

# 사용법 안내
if [ -z "$1" ]; then
  echo "사용법: $0 <server>"
  echo "서버명: cloud | gcp-vm | railway | raspberry-pi"
  exit 1
fi

SERVER="$1"

check_deps
load_server_config "$SERVER"

# Slack Webhook URL 확인
source "$ENV_FILE"
if [ -z "${SLACK_WEBHOOK_URL:-}" ]; then
  echo "오류: .env 파일에 SLACK_WEBHOOK_URL이 설정되지 않았습니다."
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "에러 핸들러 배포 중: $SERVER"
echo "URL: $N8N_URL"

WORKFLOW_JSON=$(python3 -c "
import json, sys

slack_webhook = sys.argv[1]
server_name = sys.argv[2]

wf = {
    'name': '⚠️ 에러 핸들러 - Slack 알림',
    'nodes': [
        {
            'id': 'err-0001-0001-0001-000000000001',
            'name': '에러 트리거',
            'type': 'n8n-nodes-base.errorTrigger',
            'typeVersion': 1,
            'position': [260, 300],
            'parameters': {}
        },
        {
            'id': 'err-0002-0002-0002-000000000002',
            'name': '에러 정보 추출',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [480, 300],
            'parameters': {
                'jsCode': (
                    \"const workflowName = \\\$json.workflow?.name || '알 수 없음';\\n\"
                    \"const workflowId = \\\$json.workflow?.id || 'N/A';\\n\"
                    \"const errorMessage = \\\$json.execution?.error?.message || '에러 메시지 없음';\\n\"
                    \"const executionId = \\\$json.execution?.id || 'N/A';\\n\"
                    \"const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });\\n\"
                    \"\\n\"
                    \"return [{\\n\"
                    \"  json: {\\n\"
                    \"    workflowName,\\n\"
                    \"    workflowId,\\n\"
                    \"    errorMessage,\\n\"
                    \"    executionId,\\n\"
                    \"    timestamp\\n\"
                    \"  }\\n\"
                    \"}];\"
                )
            }
        },
        {
            'id': 'err-0003-0003-0003-000000000003',
            'name': 'Slack 알림 전송',
            'type': 'n8n-nodes-base.httpRequest',
            'typeVersion': 4.2,
            'position': [700, 300],
            'parameters': {
                'method': 'POST',
                'url': slack_webhook,
                'sendBody': True,
                'specifyBody': 'string',
                'body': (
                    \"={{ JSON.stringify({\"
                    \"text: '\\\\u26A0\\\\uFE0F 워크플로우 에러 발생',\"
                    \"blocks: [\"
                    \"{type:'header',text:{type:'plain_text',text:'\\\\u26A0\\\\uFE0F 워크플로우 에러 발생'}},\"
                    \"{type:'section',fields:[\"
                    \"{type:'mrkdwn',text:'*서버:*\\\\n\" + server_name + \"'},\"
                    \"{type:'mrkdwn',text:'*워크플로우:*\\\\n'+\\\$json.workflowName},\"
                    \"{type:'mrkdwn',text:'*에러 메시지:*\\\\n'+\\\$json.errorMessage},\"
                    \"{type:'mrkdwn',text:'*실행 ID:*\\\\n\`'+\\\$json.executionId+'\`'}\"
                    \"]},\"
                    \"{type:'context',elements:[{type:'mrkdwn',text:'\\\\uD83D\\\\uDD52 '+\\\$json.timestamp}]}\"
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
        '에러 트리거': {
            'main': [[{'node': '에러 정보 추출', 'type': 'main', 'index': 0}]]
        },
        '에러 정보 추출': {
            'main': [[{'node': 'Slack 알림 전송', 'type': 'main', 'index': 0}]]
        }
    },
    'settings': {
        'executionOrder': 'v1'
    }
}

print(json.dumps(wf, ensure_ascii=False))
" "$SLACK_WEBHOOK_URL" "$SERVER")

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

  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "에러 핸들러 워크플로우 ID: $WF_ID"
  echo "이 ID를 register-error-triggers.sh에 사용하세요:"
  echo "  ./scripts/register-error-triggers.sh $SERVER $WF_ID --execute"
else
  echo "❌ 실패 (HTTP $HTTP_CODE)"
  echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2, ensure_ascii=False))" 2>/dev/null || echo "$BODY"
  exit 1
fi
