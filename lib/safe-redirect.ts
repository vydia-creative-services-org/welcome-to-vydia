import {SITE_URL} from './env'

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/'
  try {
    const site = new URL(SITE_URL)
    const url = new URL(raw, site)
    if (url.origin !== site.origin || url.pathname.startsWith('//')) return '/'
    return `${url.pathname}${url.search}`
  } catch {
    return '/'
  }
}
