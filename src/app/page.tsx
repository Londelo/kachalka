import UserSelectionClient from '@/app/components/user-selection.client'
import { getUsersAction } from '@/features/user/user-server-actions'

export default async function Home() {
  const users = await getUsersAction()

  return <UserSelectionClient initialUsers={users} />
}
