import 'server-only'
import {sanityFetch} from './fetch'
import {ARTIST_PAGE_QUERY} from './queries'
import type {ArtistPage, RawResource, ResourceCardData} from './types'

const nonEmpty = <T>(list: T[] | null | undefined): list is T[] => Array.isArray(list) && list.length > 0

function toCard(resource: RawResource): ResourceCardData | null {
  const {title, type} = resource
  return title && type ? {...resource, title, type} : null
}

export async function getArtistPage(artistId: string): Promise<ArtistPage> {
  const {website, artist} = await sanityFetch(ARTIST_PAGE_QUERY, {artistId}, ['website', 'resource', 'artist'])

  const resources = nonEmpty(artist?.resourceOverride) ? artist.resourceOverride : (website?.resources ?? [])

  return {
    artistName: artist?.name ?? '',
    additionalInfo: nonEmpty(artist?.additionalInfo) ? artist.additionalInfo : null,
    resources: resources.map(toCard).filter((card): card is ResourceCardData => card !== null),
  }
}
