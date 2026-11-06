import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import {cache} from 'react'
import {PageShell} from '@/components/PageShell'
import {hasTarget} from '@/components/ResourceCard'
import {ResourceViews} from '@/components/ResourceViews'
import {RichText} from '@/components/RichText'
import {ViewModeProvider} from '@/components/ViewMode'
import {resolveArtistAccess} from '@/lib/access'
import {greeting} from '@/lib/greeting'
import {getArtistPage} from '@/lib/sanity/page'
import {createClient} from '@/lib/supabase/server'

export const instant = false

// Shared by the page and its metadata, so each request checks sign-in and access once.
const loadArtistPage = cache(async (slug: string) => {
  const supabase = await createClient()
  const {
    data: {user},
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/${encodeURIComponent(slug)}`)

  const access = await resolveArtistAccess(slug, user)
  if (access.status === 'denied') notFound()
  if (access.status === 'redirect') redirect(`/${access.canonicalSlug}`)

  return getArtistPage(access.artistId)
})

export async function generateMetadata({params}: PageProps<'/[slug]'>): Promise<Metadata> {
  const {slug} = await params
  const page = await loadArtistPage(slug)
  return {title: greeting(page.artistName), robots: {index: false, follow: false}}
}

export default async function ArtistPage({params}: PageProps<'/[slug]'>) {
  const {slug} = await params
  const page = await loadArtistPage(slug)
  const resources = page.resources.filter(hasTarget)

  return (
    <ViewModeProvider>
      <PageShell fullscreen artistName={page.artistName}>
        <ResourceViews
          resources={resources}
          additionalInfo={page.additionalInfo && <RichText value={page.additionalInfo} />}
        />
      </PageShell>
    </ViewModeProvider>
  )
}
