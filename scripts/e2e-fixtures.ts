import {encodeSignatureHeader, SIGNATURE_HEADER_NAME} from '@sanity/webhook'
import {getCliClient} from 'sanity/cli'
import {E2E_PERSONAS, E2E_USERS} from '../tests/e2e/users'

type AdminUser = {id: string; email?: string}
type AdminUserList = {users: AdminUser[]}

const sanity = getCliClient({apiVersion: '2025-02-19'})
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')

const headers = {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json'}
const approvedEmail = E2E_USERS.approved
const artistsWithAccess = ['test-artist', 'test-renamed']

async function findUser(email: string): Promise<AdminUser | undefined> {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1000`, {headers})
  const list: AdminUserList = await response.json()
  return list.users.find((user) => user.email === email)
}

async function upsertUser(email: string) {
  const existing = await findUser(email)
  const response = existing
    ? await fetch(`${supabaseUrl}/auth/v1/admin/users/${existing.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({email_confirm: true}),
      })
    : await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({email, email_confirm: true}),
      })
  if (!response.ok) throw new Error(`Could not create ${email}: ${response.status} ${await response.text()}`)
  console.log(`${existing ? 'updated' : 'created'} ${email}`)
}

async function deleteUser(email: string) {
  const existing = await findUser(email)
  if (!existing) return
  await fetch(`${supabaseUrl}/auth/v1/admin/users/${existing.id}`, {method: 'DELETE', headers})
  console.log(`deleted ${email}`)
}

async function revalidateArtists() {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
  if (!secret) return console.warn('SANITY_REVALIDATE_SECRET not set: skipping cache revalidation.')
  const payload = JSON.stringify({_type: 'artist'})
  try {
    const response = await fetch(`${baseUrl}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SIGNATURE_HEADER_NAME]: await encodeSignatureHeader(payload, Date.now(), secret),
      },
      body: payload,
    })
    console.log(`revalidated artist cache on ${baseUrl}: ${response.status}`)
  } catch {
    console.warn(`${baseUrl} is not reachable: start the app, or rely on the Sanity webhook to revalidate.`)
  }
}

async function artistIds() {
  return sanity.fetch<string[]>('*[_type == "artist" && slug.current in $slugs]._id', {slugs: artistsWithAccess})
}

async function setup() {
  for (const persona of E2E_PERSONAS) await upsertUser(E2E_USERS[persona])
  for (const id of await artistIds()) {
    const emails = await sanity.fetch<string[] | null>('*[_id == $id][0].allowedEmails', {id})
    if ((emails ?? []).some((email) => email.toLowerCase() === approvedEmail)) continue
    await sanity
      .patch(id)
      .setIfMissing({allowedEmails: []})
      .insert('after', 'allowedEmails[-1]', [approvedEmail])
      .commit()
    console.log(`allowed ${approvedEmail} on ${id}`)
  }
  await revalidateArtists()
}

async function teardown() {
  for (const id of await artistIds()) {
    await sanity
      .patch(id)
      .unset([`allowedEmails[@ == "${approvedEmail}"]`])
      .commit()
  }
  console.log(`removed ${approvedEmail} from ${artistsWithAccess.join(', ')}`)
  await revalidateArtists()
  for (const persona of E2E_PERSONAS) await deleteUser(E2E_USERS[persona])
}

const run = process.argv.includes('teardown') ? teardown : setup
run().catch((error) => {
  console.error(error)
  process.exit(1)
})
