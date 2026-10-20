import type {ResourceType} from '@/sanity/schemaTypes/resource'
import type {ARTIST_PAGE_QUERY_RESULT, BlockContent} from './types.generated'

type RawWebsite = NonNullable<ARTIST_PAGE_QUERY_RESULT['website']>
export type RawSection = NonNullable<RawWebsite['sections']>[number]
export type RawResource = NonNullable<RawSection['resources']>[number]

export type CardCover = NonNullable<RawResource['cover']>

export type ResourceCardData = Omit<RawResource, 'title' | 'type'> & {
  title: string
  type: ResourceType
}

export type SectionData = Omit<RawSection, 'title' | 'resources'> & {
  title: string
  resources: ResourceCardData[]
}

export type ArtistPage = {
  artistName: string
  intro: BlockContent
  additionalInfo: BlockContent | null
  sections: SectionData[]
}
