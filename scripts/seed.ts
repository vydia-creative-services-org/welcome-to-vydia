import {randomUUID} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})
const key = () => randomUUID().slice(0, 12)

const span = (text: string, marks: string[] = []) => ({_type: 'span', _key: key(), text, marks})

const paragraph = (text: string) => ({
  _type: 'block',
  _key: key(),
  style: 'normal',
  markDefs: [],
  children: [span(text)],
})

const bullet = (bold: string, rest: string) => ({
  _type: 'block',
  _key: key(),
  style: 'normal',
  listItem: 'bullet',
  level: 1,
  markDefs: [],
  children: [span(bold, ['strong']), span(` - ${rest}`)],
})

const sections = [
  {_id: 'section-platform', title: 'Vydia Platform Resources'},
  {_id: 'section-pitch-forms', title: 'Playlisting and Sync Pitch Forms'},
  {_id: 'section-additional', title: 'Additional Services'},
]

async function main() {
  const tx = client.transaction()
  for (const section of sections) tx.createIfNotExists({_type: 'section', resources: [], ...section})
  tx.createIfNotExists({
    _id: 'website',
    _type: 'website',
    intro: [
      paragraph('Welcome to Vydia! Check out the resources below to get started:'),
      bullet(
        'Vydia Platform Resources',
        "Here you'll find a full guide to Vydia's platform along with video tutorials to help you get familiar with the platform.",
      ),
      bullet(
        'Playlisting and Sync Pitch Forms',
        "Leverage Vydia's playlisting and sync services to promote your upcoming and existing releases. Get started by filling out one of the forms below.",
      ),
      bullet(
        'Additional Services',
        'Learn about all that Vydia has to offer including pub admin, physical distribution, and broadcast distribution services.',
      ),
    ],
    sections: sections.map((section) => ({_type: 'reference', _ref: section._id, _key: key()})),
    internalViewerEmails: [],
  })
  await tx.commit()
  console.log('Seeded the website singleton and 3 sections (existing documents were left untouched).')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
