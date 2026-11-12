import {mkdir, readFile, writeFile} from 'node:fs/promises'

async function main() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const variables: Record<string, string> = {
    '.SiteURL': site,
    '.Email': 'lil@example.com',
    '.TokenHash': 'preview-token',
    '.RedirectTo': `${site}/lil-example`,
  }

  const template = await readFile('supabase/templates/magic-link.html', 'utf8')
  const html = template.replace(/\{\{\s*(\.\w+)\s*\}\}/g, (_, key: string) => variables[key] ?? '')
  await mkdir('.email-preview', {recursive: true})
  await writeFile('.email-preview/magic-link.html', html)
  console.log(`Open .email-preview/magic-link.html (images load from ${site})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
