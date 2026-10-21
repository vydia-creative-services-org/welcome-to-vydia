import {defineQuery} from 'next-sanity'

export const ACCESS_QUERY = defineQuery(`{
  "artist": *[_type == "artist" && (slug.current == $slug || $slug in previousSlugs)][0]{
    _id,
    "slug": slug.current,
    allowedEmails
  },
  "internalViewers": *[_type == "website" && _id == "website"][0].internalViewerEmails
}`)

const RESOURCE_PROJECTION = `{
  _id,
  title,
  type,
  url,
  "addedOn": coalesce(addedOn, _createdAt),
  "fileUrl": file.asset->url,
  "fileName": file.asset->originalFilename,
  "cover": coalesce(coverImage, pdfPreview){
    alt,
    hotspot,
    crop,
    "asset": asset->{_id, url, "lqip": metadata.lqip, "width": metadata.dimensions.width, "height": metadata.dimensions.height}
  }
}`

export const ARTIST_PAGE_QUERY = defineQuery(`{
  "website": *[_type == "website" && _id == "website"][0]{
    "resources": resources[defined(@->_id)]->${RESOURCE_PROJECTION}
  },
  "artist": *[_type == "artist" && _id == $artistId][0]{
    name,
    additionalInfo,
    "resourceOverride": resourceOverride[defined(@->_id)]->${RESOURCE_PROJECTION}
  }
}`)
