#!/usr/bin/env bash
# 신규 워크플로우 생성 Slack 알림 워크플로우 배포 스크립트
set -e

SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:?SLACK_WEBHOOK_URL 환경변수를 .env에 설정하세요}"

deploy_to_server() {
  local SERVER_URL=$1
  local API_KEY=$2
  local SERVER_NAME=$3

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "배포 중: $SERVER_NAME"
  echo "URL: $SERVER_URL"

  WORKFLOW_JSON=$(python3 -c "
import json, sys

server_url = sys.argv[1]
api_key = sys.argv[2]
server_name = sys.argv[3]
slack_webhook = sys.argv[4]

# Slack 메시지 body (expression string)
slack_body = (
    \"={{ JSON.stringify({ \"
    \"text: '\\\\ud83d\\\\udd95 새 워크플로우가 생성되었습니다!', \"
    \"blocks: [{ type: 'header', text: { type: 'plain_text', text: '\\\\ud83d\\\\udd95 새 워크플로우 생성' } }, \"
    \"{ type: 'section', fields: [\"
    \"{ type: 'mrkdwn', text: '*서버:*\\\\\\\\n\" + server_name + \"' }, \"
    \"{ type: 'mrkdwn', text: '*이름:*\\\\\\\\n' + \\\$json.name }, \"
    \"{ type: 'mrkdwn', text: '*ID:*\\\\\\\\n\`' + \\\$json.id + '\`' }, \"
    \"{ type: 'mrkdwn', text: '*생성 시간:*\\\\\\\\n' + new Date(\\\$json.createdAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) }] }, \"
    \"{ type: 'context', elements: [{ type: 'mrkdwn', text: '상태: ' + (\\\$json.active ? '\\\\u2705 활성' : '\\\\u23f8\\\\ufe0f 비활성') }] }] }) }}\"
)

wf = {
    'name': '🔔 신규 워크플로우 생성 알림',
    'nodes': [
        {
            'id': 'd1e2f3a4-0001-0001-0001-000000000001',
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
            'id': 'd1e2f3a4-0002-0002-0002-000000000002',
            'name': '마지막 체크 시간 조회',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [480, 300],
            'parameters': {
                'jsCode': \"const staticData = \\\$getWorkflowStaticData('global');\\nconst lastCheckedAt = staticData.lastCheckedAt || new Date(Date.now() - 5 * 60 * 1000).toISOString();\\nreturn [{ json: { lastCheckedAt } }];\"
            }
        },
        {
            'id': 'd1e2f3a4-0003-0003-0003-000000000003',
            'name': 'n8n API 워크플로우 목록 조회',
            'type': 'n8n-nodes-base.httpRequest',
            'typeVersion': 4.2,
            'position': [700, 300],
            'parameters': {
                'method': 'GET',
                'url': server_url + '/api/v1/workflows',
                'sendHeaders': True,
                'headerParameters': {
                    'parameters': [
                        {'name': 'X-N8N-API-KEY', 'value': api_key}
                    ]
                },
                'sendQuery': True,
                'queryParameters': {
                    'parameters': [
                        {'name': 'limit', 'value': '250'}
                    ]
                },
                'options': {}
            }
        },
        {
            'id': 'd1e2f3a4-0004-0004-0004-000000000004',
            'name': '신규 워크플로우 필터링',
            'type': 'n8n-nodes-base.code',
            'typeVersion': 2,
            'position': [920, 300],
            'parameters': {
                'jsCode': (
                    \"const lastCheckedAt = \\\$('마지막 체크 시간 조회').item.json.lastCheckedAt;\\n\"
                    \"const response = \\\$input.item.json;\\n\"
                    \"const workflows = response.data || [];\\n\\n\"
                    \"const newWorkflows = workflows.filter(wf => {\\n\"
                    \"  return new Date(wf.createdAt) > new Date(lastCheckedAt);\\n\"
                    \"});\\n\\n\"
                    \"// 체크 시간 업데이트 (항상)\\n\"
                    \"const staticData = \\\$getWorkflowStaticData('global');\\n\"
                    \"staticData.lastCheckedAt = new Date().toISOString();\\n\\n\"
                    \"if (newWorkflows.length === 0) {\\n\"
                    \"  return [];\\n\"
                    \"}\\n\\n\"
                    \"return newWorkflows.map(wf => ({ json: wf }));\"
                )
            }
        },
        {
            'id': 'd1e2f3a4-0005-0005-0005-000000000005',
            'name': 'Slack 알림 전송',
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
                    \"text: '\\\\uD83D\\\\uDD95 새 워크플로우가 생성되었습니다!',\"
                    \"blocks: [\"
                    \"{type:'header',text:{type:'plain_text',text:'\\\\uD83D\\\\uDD95 새 워크플로우 생성'}},\"
                    \"{type:'section',fields:[\"
                    \"{type:'mrkdwn',text:'*서버:*\\\\n\" + server_name + \"'},\"
                    \"{type:'mrkdwn',text:'*이름:*\\\\n'+\\\$json.name},\"
                    \"{type:'mrkdwn',text:'*ID:*\\\\n\`'+\\\$json.id+'\`'},\"
                    \"{type:'mrkdwn',text:'*생성 시간:*\\\\n'+new Date(\\\$json.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}\"
                    \"]},\"
                    \"{type:'context',elements:[{type:'mrkdwn',text:'상태: '+(\\\$json.active?'\\\\u2705 활성':'\\\\u23F8\\\\uFE0F 비활성')}]}\"
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
            'main': [[{'node': 'n8n API 워크플로우 목록 조회', 'type': 'main', 'index': 0}]]
        },
        'n8n API 워크플로우 목록 조회': {
            'main': [[{'node': '신규 워크플로우 필터링', 'type': 'main', 'index': 0}]]
        },
        '신규 워크플로우 필터링': {
            'main': [[{'node': 'Slack 알림 전송', 'type': 'main', 'index': 0}]]
        }
    },
    'settings': {
        'executionOrder': 'v1'
    }
}

print(json.dumps(wf, ensure_ascii=False))
" "$SERVER_URL" "$API_KEY" "$SERVER_NAME" "$SLACK_WEBHOOK")

  # n8n API로 워크플로우 생성
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "X-N8N-API-KEY: ${API_KEY}" \
    -d "$WORKFLOW_JSON" \
    "${SERVER_URL}/api/v1/workflows")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
    WF_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','unknown'))" 2>/dev/null || echo "unknown")
    echo "✅ 생성 성공! 워크플로우 ID: $WF_ID"

    # 워크플로우 활성화
    ACTIVATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
      -X POST \
      -H "X-N8N-API-KEY: ${API_KEY}" \
      "${SERVER_URL}/api/v1/workflows/${WF_ID}/activate")
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
}

# Cloud 서버
deploy_to_server \
  "https://datapopcorn.app.n8n.cloud" \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNmNkOTRjMi0zNjRmLTRmY2ItODhlNy0xMTg4OTgwMDBhYjciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNGExMjJjMDEtZjVlNi00ZTY1LWJmZDQtMzcwZDE3OTkwNDY1IiwiaWF0IjoxNzcwNjQ2MDQ2fQ.JTv8Pm7lUTcpieFNzD5CU5xYG6CVbthUnJcgbx3gm3I" \
  "☁️ Cloud (datapopcorn.app.n8n.cloud)"

# GCP VM 서버
deploy_to_server \
  "https://n8n.datapopcorn.win" \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1MmQ3Y2ZhZi04ZGY4LTQyMWUtYTdlNC02NDE4OWQ5MThmYmUiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzcyNzA3NjgxfQ.iFHJt9zOsO1_mmarHDMxeI5YKCj0Way_jTkpkcXeWEI" \
  "🖥️ GCP VM (n8n.datapopcorn.win)"

# Railway 서버
deploy_to_server \
  "https://n8n.datapopcorn.xyz" \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxZjQ4MTFkZS01NWM0LTQ2ZmItYTkwOS01NjkxMzQ2MzMzOWYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzUyMzg5OTQ5fQ.YlFFfI2ub9hTg8TR77WSroR6iUhRMj0i_yU3cM0rc3k" \
  "🚂 Railway (n8n.datapopcorn.xyz)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "배포 완료! 각 서버에서 5분마다 신규 워크플로우를 감지하여 Slack으로 알림을 전송합니다."
