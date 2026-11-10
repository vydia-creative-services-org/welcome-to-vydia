import {expect, test, type Page} from '@playwright/test'
import {E2E_NAMES, E2E_SLUGS, storageStatePath} from './users'

const UNKNOWN = () => `does-not-exist-${Date.now()}`

async function mainHtml(page: Page, slug: string) {
  const response = await page.goto(`/${slug}`)
  const html = await page.locator('main').innerHTML()
  return {
    status: response?.status(),
    html: html.replaceAll(slug, 'SLUG'),
    title: await page.title(),
    document: await page.content(),
  }
}

test.describe('signed out', () => {
  test('a real and a made-up slug render the same screen, with no trace of the artist', async ({page}) => {
    const real = await mainHtml(page, E2E_SLUGS.a)
    const fake = await mainHtml(page, UNKNOWN())
    expect(real.status).toBe(200)
    expect(fake.status).toBe(200)
    expect(real.html).toBe(fake.html)
    expect(real.title).toBe('Welcome to Vydia')
    expect(fake.title).toBe('Welcome to Vydia')
    expect(real.document).not.toContain(E2E_NAMES.a)
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
  })

  test('"/" is public, shows instructions, and lists no artists', async ({page}) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', {name: 'Looking for your Vydia resources?'})).toBeVisible()
    await expect(page.locator('main a')).toHaveCount(0)
  })

  test('security headers are set', async ({request}) => {
    const headers = (await request.get('/')).headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('same-origin')
    expect(headers['x-powered-by']).toBeUndefined()
  })
})

test.describe('signed in for artist A', () => {
  test.use({storageState: storageStatePath('artistA')})

  test('sees their own page', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await expect(page).toHaveTitle(`${E2E_NAMES.a} | Welcome to Vydia`)
  })

  test("opening artist B's URL shows Enter your email, never B's name or resources", async ({page}) => {
    const other = await mainHtml(page, E2E_SLUGS.b)
    expect(other.status).toBe(200)
    expect(other.title).toBe('Welcome to Vydia')
    expect(other.document).not.toContain(E2E_NAMES.b)
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
    await expect(page.getByRole('region', {name: 'Resources'})).toHaveCount(0)
  })

  test('an unknown slug looks identical to a slug they cannot access', async ({page}) => {
    const forbidden = await mainHtml(page, E2E_SLUGS.b)
    const unknown = await mainHtml(page, UNKNOWN())
    expect(forbidden.html).toBe(unknown.html)
  })

  test('has no sign-out, account menu, or links to other pages', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('button', {name: /sign out|log out/i})).toHaveCount(0)
    await expect(page.getByRole('link', {name: /account|profile|admin/i})).toHaveCount(0)
  })
})
