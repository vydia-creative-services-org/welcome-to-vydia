import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {SUPABASE_URL} from '@/lib/env'
import type {Database} from './database.types'

export function createServiceClient() {
  const secret = process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('Missing env var SUPABASE_SECRET_KEY')
  return createClient<Database>(SUPABASE_URL, secret, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
  })
}
