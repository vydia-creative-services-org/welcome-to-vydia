import {expect, test, type Page} from '@playwright/test'
import {adminClient} from './admin-client'
import {E2E_NAMES, E2E_SLUGS, E2E_TITLES, storageStatePath, type E2EPersona} from './users'

const visibleTitles = async (page: Page) => page.locator('h2.visually-hidden').allTextContents()

test.describe('client A', () => {
  test.use({storageState: storageStatePath('clientA')})

  test('sees their exclusive resources and the main resources they have not hidden', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    const titles = await visibleTitles(page)
    expect(titles).toContain(E2E_TITLES.exclusive)
    expect(titles).toContain(E2E_TITLES.mainOne)
    expect(titles).not.toContain(E2E_TITLES.mainTwo)
  })

  test('link cards open in a new tab without leaking the opener', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    const cards = page.locator('section[aria-label="Resources"] a')
    await expect(cards.first()).toBeVisible()
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('target', '_blank')
      await expect(card).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('the video dialog opens, closes on Escape, and returns focus', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    const card = page.getByRole('button', {name: new RegExp(E2E_TITLES.video)})
    await card.click()
    await expect(page.locator('dialog[open]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect(card).toBeFocused()
  })

  test('the file route redirects a viewer to a signed URL', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    await page.getByRole('button', {name: new RegExp(E2E_TITLES.video)}).click()
    const src = await page.locator('dialog[open] video').getAttribute('src')
    expect(src).toContain('/api/resources/')
    const response = await page.request.get(src ?? '', {maxRedirects: 0})
    expect(response.status()).toBe(302)
    expect(response.headers().location).toContain('/storage/v1/object/sign/resource-files/')
    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

test.describe('client B', () => {
  test.use({storageState: storageStatePath('clientB')})

  test('does not see client A’s exclusive resources, and sees the resource A hides', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.b}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    const titles = await visibleTitles(page)
    expect(titles).not.toContain(E2E_TITLES.exclusive)
    expect(titles).not.toContain(E2E_TITLES.video)
    expect(titles).toContain(E2E_TITLES.mainOne)
    expect(titles).toContain(E2E_TITLES.mainTwo)
  })

  test('the grid groups mixed-case categories under one heading', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.b}`)
    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    await expect(page.getByRole('heading', {name: 'Getting Started', exact: true})).toHaveCount(1)
    await expect(page.getByRole('link', {name: new RegExp(E2E_TITLES.mainTwo)})).toBeVisible()
  })

  test('the file route returns 404 for a resource that is not theirs', async ({request}) => {
    const response = await request.get(`/api/resources/${await exclusiveVideoId()}/file`, {maxRedirects: 0})
    expect(response.status()).toBe(404)
  })
})

test.describe('signed out', () => {
  test('the file route returns 404', async ({request}) => {
    const response = await request.get('/api/resources/00000000-0000-4000-8000-000000000000/file', {maxRedirects: 0})
    expect(response.status()).toBe(404)
    expect(response.headers()['cache-control']).toContain('no-store')
  })
})

for (const persona of ['clientA', 'manager', 'aux2'] as const satisfies readonly E2EPersona[]) {
  test.describe(`${persona}, one of client A's three emails`, () => {
    test.use({storageState: storageStatePath(persona)})

    test('sees the same page, greeted by the client', async ({page}) => {
      await page.goto(`/${E2E_SLUGS.a}`)
      await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
      await expect(page).toHaveTitle(`${E2E_NAMES.a} | Welcome to Vydia`)
      expect(await visibleTitles(page)).toContain(E2E_TITLES.exclusive)
    })
  })
}

async function exclusiveVideoId() {
  const {data} = await adminClient().from('resources').select('id').eq('title', E2E_TITLES.video).single()
  return data?.id ?? ''
}
