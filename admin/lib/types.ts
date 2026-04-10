export type ServerId = string

export type HostingType = 'gcp' | 'aws' | 'railway' | 'hostinger' | 'none'

export interface HostingConfig {
  type: HostingType
  /** Provider별 설정값 (환경변수에서 읽은 key-value) */
  params: Record<string, string>
}

export interface ServerConfig {
  id: ServerId
  name: string
  url: string
  apiKey: string
  description?: string
  hosting?: HostingConfig
}

export interface N8nWorkflow {
  id: string
  name: string
  active: boolean
  isArchived?: boolean
  createdAt: string
  updatedAt: string
  nodes?: unknown[]
  connections?: unknown
  settings?: unknown
  tags?: { id: string; name: string }[]
  shared?: { role: string; projectId: string }[]
  versionId?: string
}

export interface N8nProject {
  id: string
  name: string
  type: 'personal' | 'team'
}

export interface N8nUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  role?: string
  isPending: boolean
  createdAt: string
  updatedAt: string
  lastActiveAt?: string
  daysSinceActive?: number
}

export interface N8nCredential {
  id: string
  name: string
  type: string
  createdAt: string
  updatedAt: string
}

export interface ServerHealth {
  serverId: ServerId
  alive: boolean
  workflowCount?: number
  userCount?: number
  latencyMs?: number
  error?: string
}

export interface N8nExecution {
  id: string
  workflowId: string
  status: 'success' | 'error' | 'waiting' | 'running'
  startedAt: string
  stoppedAt?: string
  data?: unknown
}

export interface GcpVmStatus {
  status: string
  machineType: string
  externalIp?: string
  lastStartTimestamp?: string
  name: string
  zone: string
  error?: string
}

export const MACHINE_TYPES = [
  { value: 'e2-micro',      label: 'e2-micro',      specs: '1 vCPU, 1GB RAM' },
  { value: 'e2-small',      label: 'e2-small',      specs: '2 vCPU, 2GB RAM' },
  { value: 'e2-medium',     label: 'e2-medium',     specs: '2 vCPU, 4GB RAM' },
  { value: 'e2-standard-2', label: 'e2-standard-2', specs: '2 vCPU, 8GB RAM' },
  { value: 'e2-standard-4', label: 'e2-standard-4', specs: '4 vCPU, 16GB RAM' },
  { value: 'n2-standard-2', label: 'n2-standard-2', specs: '2 vCPU, 8GB RAM' },
]

export interface BatchErrorTriggerResult {
  added: { id: string; name: string }[]
  alreadyHas: { id: string; name: string }[]
  failed: { id: string; name: string; error: string }[]
}

export interface TransferResult {
  workflows: { id: string; name: string }[]
  credentials: { id: string; name: string }[]
  failed: { id: string; name: string; error: string }[]
}
