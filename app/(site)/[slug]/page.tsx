import type {Metadata} from 'next'
import {notFound} from 'next/navigation'
import {Intro} from '@/components/Intro'
import {PageShell} from '@/components/PageShell'
import {ResourceSection} from '@/components/ResourceSection'
import {RichText} from '@/components/RichText'
import {sanityFetch} from '@/lib/sanity/fetch'
import {getArtistPage} from '@/lib/sanity/page'
import {ACCESS_QUERY} from '@/lib/sanity/queries'
import styles from './page.module.css'

export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

export const instant = false

// TEMPORARY (Phase 6): renders any artist without an access check. Task 8.3 replaces this with resolveArtistAccess.
export default async function ArtistPage({params}: PageProps<'/[slug]'>) {
  const {slug} = await params
  const {artist} = await sanityFetch(ACCESS_QUERY, {slug: decodeURIComponent(slug).toLowerCase()}, [
    'artist',
    'website',
  ])
  if (!artist) notFound()
  const page = await getArtistPage(artist._id)

  return (
    <PageShell>
      <Intro value={page.intro} />
      {page.additionalInfo && (
        <section aria-label="Additional information" className={styles.additionalInfo}>
          <RichText value={page.additionalInfo} />
        </section>
      )}
      {page.sections.map((section) => (
        <ResourceSection key={section._id} section={section} />
      ))}
    </PageShell>
  )
}
