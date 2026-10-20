import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import {Intro} from '@/components/Intro'
import {PageShell} from '@/components/PageShell'
import {ResourceSection} from '@/components/ResourceSection'
import {RichText} from '@/components/RichText'
import {resolveArtistAccess} from '@/lib/access'
import {getArtistPage} from '@/lib/sanity/page'
import {createClient} from '@/lib/supabase/server'
import styles from './page.module.css'

export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

export const instant = false

export default async function ArtistPage({params}: PageProps<'/[slug]'>) {
  const {slug} = await params

  const supabase = await createClient()
  const {
    data: {user},
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${encodeURIComponent(slug)}`)

  const access = await resolveArtistAccess(slug, user)
  if (access.status === 'denied') notFound()
  if (access.status === 'redirect') redirect(`/${access.canonicalSlug}`)

  const page = await getArtistPage(access.artistId)

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
