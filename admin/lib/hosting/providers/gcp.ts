/**
 * GCP Compute Engine Provider
 *
 * 기존 gcp-client.ts를 HostingProvider 인터페이스로 래핑합니다.
 */

import { InstancesClient } from '@google-cloud/compute'
import { HostingProvider, InstanceInfo, InstanceSpec, InstanceStatus } from '../types'

const GCP_SPECS: InstanceSpec[] = [
  { value: 'e2-micro',      label: 'e2-micro',      description: '1 vCPU, 1GB RAM' },
  { value: 'e2-small',      label: 'e2-small',      description: '2 vCPU, 2GB RAM' },
  { value: 'e2-medium',     label: 'e2-medium',     description: '2 vCPU, 4GB RAM' },
  { value: 'e2-standard-2', label: 'e2-standard-2', description: '2 vCPU, 8GB RAM' },
  { value: 'e2-standard-4', label: 'e2-standard-4', description: '4 vCPU, 16GB RAM' },
  { value: 'n2-standard-2', label: 'n2-standard-2', description: '2 vCPU, 8GB RAM' },
]

function normalizeStatus(gcpStatus: string): InstanceStatus {
  switch (gcpStatus) {
    case 'RUNNING': return 'running'
    case 'TERMINATED':
    case 'STOPPED': return 'stopped'
    case 'STAGING':
    case 'PROVISIONING': return 'starting'
    case 'STOPPING':
    case 'SUSPENDING': return 'stopping'
    default: return 'unknown'
  }
}

export function createGcpProvider(params: Record<string, string>): HostingProvider {
  const projectId = params.projectId
  const zone = params.zone
  const instanceName = params.instanceName
  const serviceAccountKey = params.serviceAccountKey

  if (!projectId || !zone || !instanceName) {
    throw new Error('GCP Provider requires: projectId, zone, instanceName')
  }

  function getClient(): InstancesClient {
    if (!serviceAccountKey) throw new Error('GCP_SERVICE_ACCOUNT_KEY not set')
    const credentials = JSON.parse(Buffer.from(serviceAccountKey, 'base64').toString())
    return new InstancesClient({ credentials })
  }

  const req = { project: projectId, zone, instance: instanceName }

  return {
    id: 'gcp',
    name: 'GCP VM',
    capabilities: {
      startStop: true,
      restart: true,
      resize: true,
      redeploy: false,
    },

    async getStatus(): Promise<InstanceInfo> {
      const client = getClient()
      const [instance] = await client.get(req)
      const machineTypeFull = instance.machineType ?? ''
      const machineType = machineTypeFull.split('/').pop() ?? machineTypeFull
      const rawStatus = instance.status ?? 'UNKNOWN'

      return {
        instanceId: instanceName,
        name: instance.name ?? instanceName,
        status: normalizeStatus(rawStatus),
        rawStatus,
        endpoint: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ?? undefined,
        spec: machineType,
        lastStartedAt: instance.lastStartTimestamp ?? undefined,
        meta: { zone },
      }
    },

    async start(): Promise<void> {
      const client = getClient()
      const [operation] = await client.start(req)
      await operation.promise()
    },

    async stop(): Promise<void> {
      const client = getClient()
      const [operation] = await client.stop(req)
      await operation.promise()
    },

    async restart(): Promise<void> {
      const client = getClient()
      const [operation] = await client.reset(req)
      await operation.promise()
    },

    async resize(spec: string): Promise<void> {
      const client = getClient()

      // 실행 중이면 먼저 중지
      const [instance] = await client.get(req)
      if (instance.status === 'RUNNING') {
        const [stopOp] = await client.stop(req)
        await stopOp.promise()
      }

      // 머신 타입 변경
      const machineTypeUrl = `zones/${zone}/machineTypes/${spec}`
      const [setOp] = await client.setMachineType({
        ...req,
        instancesSetMachineTypeRequestResource: { machineType: machineTypeUrl },
      })
      await setOp.promise()

      // 재시작
      const [startOp] = await client.start(req)
      await startOp.promise()
    },

    getAvailableSpecs(): InstanceSpec[] {
      return GCP_SPECS
    },
  }
}
