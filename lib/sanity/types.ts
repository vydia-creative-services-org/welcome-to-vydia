import type {ResourceType} from '@/lib/resources/types'
import type {ARTIST_PAGE_QUERY_RESULT, BlockContent} from './types.generated'

type RawWebsite = NonNullable<ARTIST_PAGE_QUERY_RESULT['website']>
export type RawResource = NonNullable<RawWebsite['resources']>[number]

export type CardCover = NonNullable<RawResource['cover']>

export type ResourceCardData = Omit<RawResource, 'title' | 'type'> & {
  title: string
  type: ResourceType
}

export type ArtistPage = {
  artistName: string
  additionalInfo: BlockContent | null
  resources: ResourceCardData[]
}
