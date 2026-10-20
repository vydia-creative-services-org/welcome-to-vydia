import type {SanityDocument} from 'sanity'

export const currentSlug = (doc: SanityDocument | null) => {
  const slug = doc?.slug
  return slug && typeof slug === 'object' && 'current' in slug && typeof slug.current === 'string'
    ? slug.current
    : undefined
}
