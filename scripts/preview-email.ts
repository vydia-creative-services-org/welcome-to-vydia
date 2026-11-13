import {mkdir, writeFile} from 'node:fs/promises'
import {accessLink, welcomeEmail} from '../lib/welcome-email'

async function main() {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const {subject, html, text} = welcomeEmail({
    siteUrl: site,
    email: 'lil@example.com',
    clientName: 'Lil Example',
    link: accessLink(site, '0'.repeat(64)),
  })
  await mkdir('.email-preview', {recursive: true})
  await writeFile('.email-preview/welcome.html', html)
  await writeFile('.email-preview/welcome.txt', `Subject: ${subject}\n\n${text}`)
  console.log(`Open .email-preview/welcome.html (images load from ${site})`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
