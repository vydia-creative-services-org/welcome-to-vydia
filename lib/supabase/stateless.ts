import 'server-only'
import {createClient} from '@supabase/supabase-js'
import {SUPABASE_KEY, SUPABASE_URL} from '@/lib/env'
import type {Database} from './database.types'

// No session or cookies: magic links are sent from after(), once the response is gone, and are verified by token hash.
export const createStatelessClient = () =>
  createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit'},
  })
