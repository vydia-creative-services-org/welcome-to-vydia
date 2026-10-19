function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

export const SITE_URL = required('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL)
export const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
export const SUPABASE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
)
