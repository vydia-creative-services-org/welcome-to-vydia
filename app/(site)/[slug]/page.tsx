import type {Metadata} from 'next'
import {notFound, redirect} from 'next/navigation'
import {PageShell} from '@/components/PageShell'
import {hasTarget} from '@/components/ResourceCard'
import {ResourceViews} from '@/components/ResourceViews'
import {RichText} from '@/components/RichText'
import {ViewModeProvider} from '@/components/ViewMode'
import {resolveArtistAccess} from '@/lib/access'
import {getArtistPage} from '@/lib/sanity/page'
import {createClient} from '@/lib/supabase/server'

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
  // Both views show every resource in one list; a resource shared by two sections appears once.
  const resources = [
    ...new Map(page.sections.flatMap((section) => section.resources.filter(hasTarget)).map((r) => [r._id, r])).values(),
  ]

  return (
    <ViewModeProvider>
      <PageShell fullscreen>
        <ResourceViews
          resources={resources}
          additionalInfo={page.additionalInfo && <RichText value={page.additionalInfo} />}
        />
      </PageShell>
    </ViewModeProvider>
  )
}
