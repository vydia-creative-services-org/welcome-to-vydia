import {createClient} from '@supabase/supabase-js'
import type {Database} from '../../lib/supabase/database.types'
import {E2E_USERS} from './users'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set.`)
  return value
}

export const adminClient = () =>
  createClient<Database>(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SECRET_KEY'), {
    auth: {persistSession: false, autoRefreshToken: false},
  })

export async function userEmails() {
  const {data, error} = await adminClient().auth.admin.listUsers({page: 1, perPage: 1000})
  if (error) throw error
  return data.users.map((user) => user.email ?? '')
}

export async function hashedToken(email: string) {
  const {data, error} = await adminClient().auth.admin.generateLink({type: 'magiclink', email})
  if (error) throw error
  return data.properties.hashed_token
}

export const confirmPath = (tokenHash: string, next: string) =>
  `/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=email&redirect_to=${encodeURIComponent(next)}`

export const personaEmails = Object.values(E2E_USERS)
