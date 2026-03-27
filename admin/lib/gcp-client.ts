import { InstancesClient } from '@google-cloud/compute'
import { GcpVmStatus } from './types'

function getClient() {
  const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY
  if (!keyBase64) throw new Error('GCP_SERVICE_ACCOUNT_KEY not set')
  const credentials = JSON.parse(Buffer.from(keyBase64, 'base64').toString())
  return new InstancesClient({ credentials })
}

const PROJECT = (process.env.GCP_PROJECT_ID ?? '').trim()
const ZONE = (process.env.GCP_ZONE ?? '').trim()
const INSTANCE = (process.env.GCP_INSTANCE_NAME ?? '').trim()

export async function getVmStatus(): Promise<GcpVmStatus> {
  const client = getClient()
  const [instance] = await client.get({ project: PROJECT, zone: ZONE, instance: INSTANCE })

  const machineTypeFull = instance.machineType ?? ''
  const machineType = machineTypeFull.split('/').pop() ?? machineTypeFull

  return {
    status: instance.status ?? 'UNKNOWN',
    machineType,
    externalIp: instance.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP ?? undefined,
    lastStartTimestamp: instance.lastStartTimestamp ?? undefined,
    name: instance.name ?? INSTANCE,
    zone: ZONE,
  }
}

export async function startVm(): Promise<void> {
  const client = getClient()
  const [operation] = await client.start({ project: PROJECT, zone: ZONE, instance: INSTANCE })
  await operation.promise()
}

export async function stopVm(): Promise<void> {
  const client = getClient()
  const [operation] = await client.stop({ project: PROJECT, zone: ZONE, instance: INSTANCE })
  await operation.promise()
}

export async function restartVm(): Promise<void> {
  const client = getClient()
  const [operation] = await client.reset({ project: PROJECT, zone: ZONE, instance: INSTANCE })
  await operation.promise()
}

export async function resizeVm(machineType: string): Promise<void> {
  const client = getClient()

  // 실행 중이면 먼저 중지
  const status = await getVmStatus()
  if (status.status === 'RUNNING') {
    const [stopOp] = await client.stop({ project: PROJECT, zone: ZONE, instance: INSTANCE })
    await stopOp.promise()
  }

  // 머신 타입 변경
  const machineTypeUrl = `zones/${ZONE}/machineTypes/${machineType}`
  const [setOp] = await client.setMachineType({
    project: PROJECT,
    zone: ZONE,
    instance: INSTANCE,
    instancesSetMachineTypeRequestResource: { machineType: machineTypeUrl },
  })
  await setOp.promise()

  // 재시작
  const [startOp] = await client.start({ project: PROJECT, zone: ZONE, instance: INSTANCE })
  await startOp.promise()
}
