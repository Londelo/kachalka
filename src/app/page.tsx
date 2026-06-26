import UserSelectionClient from '@/components/user-selection.client'
import { getUsersAction } from '@/features/user/user-server-actions'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const users = await getUsersAction()

  return <UserSelectionClient initialUsers={users} />
}
