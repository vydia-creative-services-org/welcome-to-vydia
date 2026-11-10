import {notFound} from 'next/navigation'
import {ArtistForm} from '@/components/admin/ArtistForm'
import controls from '@/components/admin/controls.module.css'
import {CopyLinkButton} from '@/components/admin/CopyLinkButton'
import {DeleteArtistButton} from '@/components/admin/DeleteArtistButton'
import {requireAdmin} from '@/lib/admin/auth'
import {toFormInitial} from '@/lib/admin/form-initial'
import {welcomeLink} from '@/lib/admin/welcome-link'
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

  const link = welcomeLink(artist.slug)
  return (
    <div className={styles.stack}>
      <section className={`${controls.card} ${detail.welcome}`} aria-labelledby="welcome-title">
        <div className={detail.heading}>
          <h1 id="welcome-title" className={styles.pageTitle}>
            {artist.name}
          </h1>
          {saved && (
            <p role="status" className={controls.success}>
              Saved.
            </p>
          )}
        </div>
        <p className={controls.hint}>Welcome link. Copy it into your own email to the artist.</p>
        <div className={detail.link}>
          <code className={detail.url}>{link}</code>
          <CopyLinkButton slug={artist.slug} size="regular" />
          <a href={`/${artist.slug}`} target="_blank" rel="noopener" className={controls.button}>
            Open page
          </a>
        </div>
      </section>

      <ArtistForm key={`${artist.id}:${artist.updated_at}`} initial={toFormInitial(artist)} {...context} />

      <section className={detail.danger}>
        <DeleteArtistButton id={artist.id} name={artist.name} />
      </section>
    </div>
  )
}
