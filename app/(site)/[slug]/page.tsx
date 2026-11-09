import type {Metadata} from 'next'
import {PageShell} from '@/components/PageShell'
import {ResourceViews} from '@/components/ResourceViews'
import {ViewModeProvider} from '@/components/ViewMode'
import {getArtistPage} from '@/lib/artist-page'
import {greeting} from '@/lib/greeting'
import {normalizeSlug} from '@/lib/slug'
import {EnterEmail} from './EnterEmail'

export const instant = false

export async function generateMetadata({params}: PageProps<'/[slug]'>): Promise<Metadata> {
  const {slug} = await params
  const page = await getArtistPage(slug)
  return {title: greeting(page?.artistName), robots: {index: false, follow: false}}
}

export default async function ArtistRoute({params}: PageProps<'/[slug]'>) {
  const {slug} = await params
  const page = await getArtistPage(slug)

  if (!page) {
    return (
      <PageShell>
        <EnterEmail slug={normalizeSlug(slug)} />
      </PageShell>
    )
  }

  return (
    <ViewModeProvider>
      <PageShell fullscreen artistName={page.artistName}>
        <h1 className="visually-hidden">{greeting(page.artistName)}</h1>
        <ResourceViews groups={page.groups} />
      </PageShell>
    </ViewModeProvider>
  )
}
