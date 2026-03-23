import { getServers } from '@/lib/server-config'
import WorkflowsClient from './workflows-client'

export const dynamic = 'force-dynamic'

export default function WorkflowsPage() {
  const servers = getServers()
  return <WorkflowsClient servers={servers} />
}
