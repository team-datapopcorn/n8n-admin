import { getServers } from '@/lib/server-config'
import UsersClient from './users-client'

export default function UsersPage() {
  const servers = getServers()
  return <UsersClient servers={servers} />
}
