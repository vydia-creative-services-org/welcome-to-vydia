// One-off: flatten sections into website.resources / artist.resourceOverride, drop intro fields, delete sections.
// Dry run: npx sanity exec scripts/migrate-remove-sections.ts --with-user-token
// Apply:   npx sanity exec scripts/migrate-remove-sections.ts --with-user-token -- --apply
import {randomUUID} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-02-19'})
const apply = process.argv.includes('--apply')
const key = () => randomUUID().slice(0, 12)

type Target = {_id: string; _type: 'website' | 'artist'; sectionRefs: string[] | null; hasList: boolean}

async function main() {
  const {targets, sections, resourceIds} = await client.fetch<{
    targets: Target[]
    sections: {_id: string; resources: string[] | null}[]
    resourceIds: string[]
  }>(`{
    "targets": *[_type in ["website", "artist"] && (
      defined(intro) || defined(sections) || defined(introOverride) || defined(sectionOverride) || defined(customization)
    )]{
      _id, _type,
      "sectionRefs": coalesce(sections, sectionOverride)[]._ref,
      "hasList": defined(coalesce(resources, resourceOverride))
    },
    "sections": *[_type == "section"]{_id, "resources": resources[]._ref},
    "resourceIds": *[_type == "resource" && !(_id in path("drafts.**"))]._id
  }`)

  const sectionById = new Map(sections.map((s) => [s._id, s.resources ?? []]))
  const published = new Set(resourceIds)

  const tx = client.transaction()
  for (const doc of targets) {
    const field = doc._type === 'website' ? 'resources' : 'resourceOverride'
    const flattened = [
      ...new Set((doc.sectionRefs ?? []).flatMap((id) => sectionById.get(id) ?? []).filter((id) => published.has(id))),
    ]
    const patch = client.patch(doc._id).unset(['intro', 'sections', 'introOverride', 'sectionOverride', 'customization'])
    if (!doc.hasList && flattened.length) {
      patch.set({[field]: flattened.map((_ref) => ({_type: 'reference', _ref, _key: key()}))})
    }
    tx.patch(patch)
    console.log(`${doc._id}: unset intro/section fields${doc.hasList ? '' : `, ${field} = [${flattened.join(', ')}]`}`)
  }
  console.log(`delete sections: ${sections.map((s) => s._id).join(', ') || '(none)'}`)

  if (!apply) return console.log('\nDry run. Re-run with -- --apply to write.')
  if (targets.length) await tx.commit()
  if (sections.length) {
    await sections.reduce((del, s) => del.delete(s._id), client.transaction()).commit()
  }
  console.log('Done.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
