import {HomeIcon} from '@sanity/icons/Home'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Welcome to Vydia')
    .items([
      S.documentTypeListItem('artist').title('Artists'),
      S.divider(),
      S.documentTypeListItem('resource').title('Resources'),
      S.documentTypeListItem('section').title('Sections'),
      S.listItem()
        .title('Website')
        .id('website')
        .icon(HomeIcon)
        .child(S.document().schemaType('website').documentId('website').title('Website')),
    ])
