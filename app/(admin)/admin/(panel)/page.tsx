import {requireAdmin} from '@/lib/admin/auth'

export const instant = false

export default async function ArtistIndex() {
  await requireAdmin()
  return <h1>Artists</h1>
}
