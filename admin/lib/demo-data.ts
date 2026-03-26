import type { N8nWorkflow, N8nUser, N8nCredential, ServerConfig } from './types'

export const DEMO_SERVER: ServerConfig = {
  id: 'demo',
  name: 'Demo Server',
  url: 'https://demo.example.n8n.cloud',
  apiKey: 'demo-api-key',
  description: '데모 모드 — 실제 서버에 연결되지 않습니다',
}

export const DEMO_WORKFLOWS: N8nWorkflow[] = [
  {
    id: 'wf-demo-001',
    name: '[CRON] 매일 아침 AI 브리핑',
    active: true,
    createdAt: '2024-11-01T09:00:00.000Z',
    updatedAt: '2025-03-20T03:00:00.000Z',
    tags: [{ id: 'tag-1', name: 'cron' }, { id: 'tag-2', name: 'ai' }],
  },
  {
    id: 'wf-demo-002',
    name: '[Webhook] Slack 알림 자동화',
    active: true,
    createdAt: '2024-12-15T14:30:00.000Z',
    updatedAt: '2025-03-22T10:15:00.000Z',
    tags: [{ id: 'tag-3', name: 'webhook' }, { id: 'tag-4', name: 'slack' }],
  },
  {
    id: 'wf-demo-003',
    name: '[Schedule] Google Sheets 데이터 동기화',
    active: true,
    createdAt: '2025-01-10T08:00:00.000Z',
    updatedAt: '2025-03-25T06:00:00.000Z',
    tags: [{ id: 'tag-5', name: 'schedule' }, { id: 'tag-6', name: 'sheets' }],
  },
  {
    id: 'wf-demo-004',
    name: 'Copy of My Workflow (1)',
    active: false,
    createdAt: '2025-02-03T11:20:00.000Z',
    updatedAt: '2025-02-03T11:20:00.000Z',
    tags: [],
  },
  {
    id: 'wf-demo-005',
    name: 'test',
    active: false,
    createdAt: '2025-03-01T16:45:00.000Z',
    updatedAt: '2025-03-01T16:45:00.000Z',
    tags: [],
  },
]

export const DEMO_USERS: N8nUser[] = [
  {
    id: 'user-demo-001',
    email: 'owner@example.com',
    firstName: '지수',
    lastName: '김',
    role: 'global:owner',
    isPending: false,
    createdAt: '2024-10-01T00:00:00.000Z',
    updatedAt: '2025-03-25T09:00:00.000Z',
    lastActiveAt: '2025-03-25T09:00:00.000Z',
    daysSinceActive: 1,
  },
  {
    id: 'user-demo-002',
    email: 'member@example.com',
    firstName: '민준',
    lastName: '이',
    role: 'global:member',
    isPending: false,
    createdAt: '2024-11-15T00:00:00.000Z',
    updatedAt: '2025-03-18T14:00:00.000Z',
    lastActiveAt: '2025-03-18T14:00:00.000Z',
    daysSinceActive: 8,
  },
  {
    id: 'user-demo-003',
    email: 'dormant@example.com',
    firstName: '서연',
    lastName: '박',
    role: 'global:member',
    isPending: false,
    createdAt: '2024-09-01T00:00:00.000Z',
    updatedAt: '2024-10-01T00:00:00.000Z',
    lastActiveAt: '2024-10-01T00:00:00.000Z',
    daysSinceActive: 177,
  },
]

export const DEMO_CREDENTIALS: N8nCredential[] = [
  {
    id: 'cred-demo-001',
    name: 'OpenAI API',
    type: 'openAiApi',
    createdAt: '2024-10-05T10:00:00.000Z',
    updatedAt: '2025-01-10T10:00:00.000Z',
  },
  {
    id: 'cred-demo-002',
    name: 'Slack OAuth',
    type: 'slackOAuth2Api',
    createdAt: '2024-11-20T09:30:00.000Z',
    updatedAt: '2025-02-14T09:30:00.000Z',
  },
  {
    id: 'cred-demo-003',
    name: 'Google Sheets Service Account',
    type: 'googleSheetsOAuth2Api',
    createdAt: '2025-01-08T11:00:00.000Z',
    updatedAt: '2025-03-01T11:00:00.000Z',
  },
  {
    id: 'cred-demo-004',
    name: 'test credential',
    type: 'httpBasicAuth',
    createdAt: '2025-03-10T15:00:00.000Z',
    updatedAt: '2025-03-10T15:00:00.000Z',
  },
]
