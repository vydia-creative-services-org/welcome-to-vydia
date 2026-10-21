import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})
const DEFAULT_INTERNAL_VIEWERS = ['erica.johnson@vydia.com', 'mason.omara@vydia.com']

async function main() {
  await client.createIfNotExists({_id: 'website', _type: 'website', resources: [], internalViewerEmails: []})

  const current = await client.fetch<string[] | null>('*[_id == "website"][0].internalViewerEmails')
  const listed = new Set((current ?? []).map((email) => email.trim().toLowerCase()))
  const missing = DEFAULT_INTERNAL_VIEWERS.filter((email) => !listed.has(email))
  if (missing.length) {
    await client
      .patch('website')
      .setIfMissing({internalViewerEmails: []})
      .append('internalViewerEmails', missing)
      .commit()
  }
  console.log(`Website singleton ready. Added internal viewers: ${missing.join(', ') || 'none'}.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
