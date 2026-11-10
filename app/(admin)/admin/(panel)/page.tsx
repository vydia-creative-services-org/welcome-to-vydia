import Link from 'next/link'
import {ArtistTable} from '@/components/admin/ArtistTable'
import controls from '@/components/admin/controls.module.css'
import {requireAdmin} from '@/lib/admin/auth'
import styles from './panel.module.css'

export const instant = false

export default async function ArtistIndex() {
  const {supabase} = await requireAdmin()
  const {data} = await supabase
    .from('artists')
    .select('id, name, slug, created_at, artist_emails(email, is_primary)')
    .order('created_at', {ascending: false})

  const rows = (data ?? []).map((artist) => ({
    id: artist.id,
    name: artist.name,
    slug: artist.slug,
    createdAt: artist.created_at,
    primaryEmail: artist.artist_emails.find((email) => email.is_primary)?.email ?? '',
    auxCount: artist.artist_emails.filter((email) => !email.is_primary).length,
    allEmails: artist.artist_emails.map((email) => email.email),
  }))

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Artists</h1>
        <Link href="/admin/artists/new" className={`${controls.button} ${controls.primary}`}>
          New artist
        </Link>
      </header>
      <ArtistTable rows={rows} />
    </>
  )
}
