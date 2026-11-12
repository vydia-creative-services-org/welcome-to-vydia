import {mkdir, readFile, writeFile} from 'node:fs/promises'
import sharp from 'sharp'

const INK = '#171717'
const WHITE = '#ffffff'

function ico(images: {size: number; data: Buffer}[]) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = 6 + images.length * 16
  const entries = images.map(({size, data}) => {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size, 0)
    entry.writeUInt8(size, 1)
    entry.writeUInt16LE(1, 4)
    entry.writeUInt16LE(32, 6)
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    return entry
  })
  return Buffer.concat([header, ...entries, ...images.map(({data}) => data)])
}

async function main() {
  const source = await readFile('public/vydia-logo.svg', 'utf8')
  const paint = (color: string) => Buffer.from(source.replaceAll('#171717', color))

  const mark = (color: string, size: number) =>
    sharp(paint(color), {density: 600}).resize({width: size, height: size}).png().toBuffer()

  const tile = async (size: number, scale: number, radius: number) => {
    const inner = Math.round(size * scale)
    const mask = Buffer.from(
      `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radius)}"/></svg>`,
    )
    const base = await sharp({create: {width: size, height: size, channels: 4, background: WHITE}})
      .composite([{input: await mark(INK, inner), gravity: 'center'}])
      .png()
      .toBuffer()
    return sharp(base)
      .composite([{input: mask, blend: 'dest-in'}])
      .png()
      .toBuffer()
  }

  await mkdir('public/email', {recursive: true})
  await writeFile('public/email/vydia-mark-ink.png', await mark(INK, 112))
  await writeFile('public/email/vydia-mark-white.png', await mark(WHITE, 112))

  const favicon = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg"><style>path{fill:${INK}}@media(prefers-color-scheme:dark){path{fill:#ededed}}</style>${source.match(/<path[\s\S]*<\/path>|<path[^>]*\/>/g)?.join('') ?? ''}</svg>\n`
  await writeFile('app/icon0.svg', favicon)
  await writeFile('app/icon1.png', await tile(96, 0.62, 0.22))
  await writeFile('app/apple-icon.png', await tile(180, 0.62, 0))
  await writeFile(
    'app/favicon.ico',
    ico([
      {size: 32, data: await tile(32, 0.7, 0.22)},
      {size: 48, data: await tile(48, 0.7, 0.22)},
    ]),
  )
  await writeFile('public/web-app-manifest-192x192.png', await tile(192, 0.55, 0))
  await writeFile('public/web-app-manifest-512x512.png', await tile(512, 0.55, 0))
  console.log('Wrote email marks, favicon, app icons, and manifest icons')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
