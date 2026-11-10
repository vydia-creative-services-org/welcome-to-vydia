import {adminClient, personaEmails} from '../tests/e2e/admin-client'
import {E2E_NAMES, E2E_SLUGS, E2E_TITLES, E2E_USERS} from '../tests/e2e/users'

const supabase = adminClient()
const slugs = [E2E_SLUGS.a, E2E_SLUGS.b]

async function teardown() {
  const {data: exclusives} = await supabase
    .from('resources')
    .select('file, artist_id, artists!inner(slug)')
    .in('artists.slug', slugs)
  const files = (exclusives ?? []).flatMap((row) => (row.file ? [row.file] : []))
  if (files.length) await supabase.storage.from('resource-files').remove(files)

  await supabase.from('artists').delete().in('slug', slugs)
  await supabase.from('resources').delete().like('title', 'E2E %').is('artist_id', null)

  const {data} = await supabase.auth.admin.listUsers({page: 1, perPage: 1000})
  for (const user of data?.users ?? []) {
    if (user.email && personaEmails.some((email) => email === user.email)) await supabase.auth.admin.deleteUser(user.id)
  }
}

async function insertArtist(name: string, slug: string, emails: {email: string; label: string; primary: boolean}[]) {
  const {data, error} = await supabase.from('artists').insert({name, slug}).select('id').single()
  if (error) throw error
  const {error: emailError} = await supabase
    .from('artist_emails')
    .insert(emails.map((e) => ({artist_id: data.id, email: e.email, label: e.label, is_primary: e.primary})))
  if (emailError) throw emailError
  return data.id
}

async function setup() {
  await teardown()

  const artistA = await insertArtist(E2E_NAMES.a, E2E_SLUGS.a, [
    {email: E2E_USERS.artistA, label: 'Artist', primary: true},
    {email: E2E_USERS.manager, label: 'Manager', primary: false},
    {email: E2E_USERS.aux2, label: 'Alt', primary: false},
  ])
  await insertArtist(E2E_NAMES.b, E2E_SLUGS.b, [{email: E2E_USERS.artistB, label: 'Artist', primary: true}])

  const {data: main, error} = await supabase
    .from('resources')
    .insert([
      {title: E2E_TITLES.mainOne, type: 'link', url: 'https://example.com/e2e-one', category: 'Getting Started'},
      {title: E2E_TITLES.mainTwo, type: 'link', url: 'https://example.com/e2e-two', category: 'getting started'},
    ])
    .select('id, title')
  if (error) throw error
  const hidden = main.find((row) => row.title === E2E_TITLES.mainTwo)
  if (!hidden) throw new Error('The hidden main resource was not created.')
  const {error: hideError} = await supabase
    .from('artist_hidden_resources')
    .insert({artist_id: artistA, resource_id: hidden.id})
  if (hideError) throw hideError

  const videoId = crypto.randomUUID()
  const videoPath = `${videoId}/file-e2e.mp4`
  const {error: uploadError} = await supabase.storage
    .from('resource-files')
    .upload(videoPath, new Blob([new Uint8Array(2048)], {type: 'video/mp4'}), {contentType: 'video/mp4'})
  if (uploadError) throw uploadError

  const {error: exclusiveError} = await supabase.from('resources').insert([
    {
      id: crypto.randomUUID(),
      artist_id: artistA,
      title: E2E_TITLES.exclusive,
      type: 'link',
      url: 'https://example.com/e2e-a',
      category: 'Your Releases',
    },
    {
      id: videoId,
      artist_id: artistA,
      title: E2E_TITLES.video,
      type: 'video',
      file: videoPath,
      category: 'Your Releases',
    },
  ])
  if (exclusiveError) throw exclusiveError
  console.log('e2e fixtures ready')
}

const run = process.argv.includes('teardown') ? teardown : setup
run()
  .then(() => process.argv.includes('teardown') && console.log('e2e fixtures removed'))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
