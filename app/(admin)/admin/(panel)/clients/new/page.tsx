import {ArtistForm} from '@/components/admin/ArtistForm'
import {requireAdmin} from '@/lib/admin/auth'
import {emptyArtistForm} from '@/lib/admin/form-initial'
import {loadResourceContext} from '@/lib/admin/resource-context'
import styles from '../../panel.module.css'

export const instant = false

export default async function NewArtist() {
  const {supabase} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>New artist</h1>
      </header>
      <ArtistForm initial={emptyArtistForm} mainResources={mainResources} categories={categories} />
    </>
  )
}
