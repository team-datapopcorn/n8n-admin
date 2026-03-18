import { getServers } from '@/lib/server-config'
import CredentialsClient from './credentials-client'

export default function CredentialsPage() {
  const servers = getServers()
  return <CredentialsClient servers={servers} />
}
