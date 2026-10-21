import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})

async function main() {
  await client.createIfNotExists({_id: 'website', _type: 'website', resources: [], internalViewerEmails: []})
  console.log('Seeded the website singleton (an existing one was left untouched).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
