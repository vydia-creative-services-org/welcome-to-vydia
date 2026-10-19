export const RESERVED_SLUGS = new Set([
  'studio',
  'login',
  'logout',
  'auth',
  'api',
  'account',
  'admin',
  '_next',
  'static',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
])

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '')
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
