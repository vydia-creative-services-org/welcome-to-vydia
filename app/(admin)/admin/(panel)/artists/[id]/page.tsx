import {notFound} from 'next/navigation'
import {ArtistForm} from '@/components/admin/ArtistForm'
import controls from '@/components/admin/controls.module.css'
import {CopyLinkButton} from '@/components/admin/CopyLinkButton'
import {DeleteArtistButton} from '@/components/admin/DeleteArtistButton'
import {requireAdmin} from '@/lib/admin/auth'
import {toFormInitial} from '@/lib/admin/form-initial'
import {loadResourceContext} from '@/lib/admin/resource-context'
import styles from '../../panel.module.css'
import detail from './detail.module.css'

export const instant = false

export default async function ArtistDetail({params, searchParams}: PageProps<'/admin/artists/[id]'>) {
  const {id} = await params
  const {saved} = await searchParams
  const {supabase} = await requireAdmin()

  const [{data: artist, error}, context] = await Promise.all([
    supabase
      .from('artists')
      .select(
        'id, name, slug, updated_at, artist_emails(email, label, is_primary), artist_hidden_resources(resource_id), resources!resources_artist_id_fkey(*)',
      )
      .eq('id', id)
      .maybeSingle(),
    loadResourceContext(supabase),
  ])
  if (error) throw new Error(`Couldn’t load the artist: ${error.message}`)
  if (!artist) notFound()

  return (
    <div className={styles.stack}>
      <header className={styles.pageHeader}>
        <div className={detail.heading}>
          <h1 className={styles.pageTitle}>{artist.name}</h1>
          {saved && (
            <p role="status" className={controls.success}>
              Saved
            </p>
          )}
        </div>
        <div className={detail.actions}>
          <CopyLinkButton slug={artist.slug} />
          <a href={`/${artist.slug}`} target="_blank" rel="noopener" className={controls.button}>
            Open
          </a>
        </div>
      </header>

      <ArtistForm key={`${artist.id}:${artist.updated_at}`} initial={toFormInitial(artist)} {...context} />

      <section className={detail.danger}>
        <DeleteArtistButton id={artist.id} name={artist.name} />
      </section>
    </div>
  )
}
