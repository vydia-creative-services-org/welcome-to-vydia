import 'server-only'
import {sanityFetch} from './fetch'
import {ARTIST_PAGE_QUERY} from './queries'
import type {ArtistPage, RawResource, RawSection, ResourceCardData, SectionData} from './types'

const nonEmpty = <T>(list: T[] | null | undefined): list is T[] => Array.isArray(list) && list.length > 0

function toCard(resource: RawResource): ResourceCardData | null {
  const {title, type} = resource
  return title && type ? {...resource, title, type} : null
}

function toSection(section: RawSection): SectionData {
  const resources = (section.resources ?? []).map(toCard).filter((card): card is ResourceCardData => card !== null)
  return {...section, title: section.title ?? '', resources}
}

export async function getArtistPage(artistId: string): Promise<ArtistPage> {
  const {website, artist} = await sanityFetch(ARTIST_PAGE_QUERY, {artistId}, [
    'website',
    'section',
    'resource',
    'artist',
  ])

  const intro = nonEmpty(artist?.introOverride) ? artist.introOverride : (website?.intro ?? [])
  const sections = nonEmpty(artist?.sectionOverride) ? artist.sectionOverride : (website?.sections ?? [])

  return {
    artistName: artist?.name ?? '',
    intro,
    additionalInfo: nonEmpty(artist?.additionalInfo) ? artist.additionalInfo : null,
    sections: sections.map(toSection),
  }
}
