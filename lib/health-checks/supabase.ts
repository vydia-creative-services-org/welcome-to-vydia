import type {SupabaseClient} from '@supabase/supabase-js'
import {fetchOk, type Check} from '@/lib/health'

/** GoTrue up. url = https://<ref>.supabase.co, key = publishable/anon key. */
export const supabaseAuth =
  (url: string, key: string): Check =>
  (signal) =>
    fetchOk(`${url}/auth/v1/health`, {headers: {apikey: key}, signal})

/** Google provider enabled in Supabase Auth settings. */
export const supabaseGoogleEnabled =
  (url: string, key: string): Check =>
  async (signal) => {
    const s = await (await fetchOk(`${url}/auth/v1/settings`, {headers: {apikey: key}, signal})).json()
    if (s?.external?.google !== true) throw new Error('google provider disabled')
  }

/** One-row read. supabase-js resolves on error, so we must throw. */
export const supabaseTable =
  (db: SupabaseClient, table: string, column = 'id'): Check =>
  async (signal) => {
    const {error} = await db.from(table).select(column).limit(1).abortSignal(signal)
    if (error) throw error
  }

export const supabaseBucket =
  (db: SupabaseClient, bucket: string): Check =>
  async () => {
    const {error} = await db.storage.getBucket(bucket)
    if (error) throw error
  }
