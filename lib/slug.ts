export const SLUG_MIN = 3
export const SLUG_MAX = 60

export const RESERVED_SLUGS = new Set(['admin', 'api', 'auth', 'login', 'logout', 'account', 'studio', 'static'])

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isValidSlug = (slug: string) =>
  slug.length >= SLUG_MIN && slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug)

export function normalizeSlug(raw: string) {
  try {
    return decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return raw.trim().toLowerCase()
  }
}
