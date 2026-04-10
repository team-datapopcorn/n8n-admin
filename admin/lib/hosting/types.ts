/**
 * 호스팅 Provider 공통 인터페이스
 *
 * n8n을 띄우는 인프라(GCP, AWS, Railway, Hostinger 등)를
 * 동일한 인터페이스로 관리할 수 있게 합니다.
 */

export type { HostingType, HostingConfig } from '../types'

// ─── 공통 상태 ──────────────────────────────────────────────────

export type InstanceStatus =
  | 'running'
  | 'stopped'
  | 'starting'
  | 'stopping'
  | 'unknown'

export interface InstanceInfo {
  instanceId: string
  name: string
  status: InstanceStatus
  rawStatus: string
  endpoint?: string
  spec?: string
  lastStartedAt?: string
  meta?: Record<string, unknown>
}

// ─── 스펙/플랜 ──────────────────────────────────────────────────

export interface InstanceSpec {
  value: string
  label: string
  description: string
}

// ─── Provider 기능 선언 ─────────────────────────────────────────

export interface ProviderCapabilities {
  startStop: boolean
  restart: boolean
  resize: boolean
  redeploy: boolean
}

// ─── Provider 인터페이스 ────────────────────────────────────────

export interface HostingProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: ProviderCapabilities

  getStatus(): Promise<InstanceInfo>
  start?(): Promise<void>
  stop?(): Promise<void>
  restart?(): Promise<void>
  resize?(spec: string): Promise<void>
  redeploy?(): Promise<void>
  getAvailableSpecs?(): InstanceSpec[]
}
