import {expect, test} from '@playwright/test'
import {storageStatePath} from './users'

const UNKNOWN = 'definitely-not-a-real-artist'

test.describe('signed out', () => {
  test('real and fake artist URLs both go to login, with the same redirect', async ({page}) => {
    for (const slug of ['test-artist', UNKNOWN]) {
      await page.goto(`/${slug}`)
      await expect(page).toHaveURL(`/login?next=%2F${slug}`)
      await expect(page.getByRole('heading', {name: 'Sign in'})).toBeVisible()
    }
  })

  test('"/" is public, shows instructions, and lists no artists', async ({page}) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', {name: 'Looking for your Vydia resources?'})).toBeVisible()
    await expect(page.locator('main a')).toHaveCount(0)
  })

  test('security headers are set', async ({request}) => {
    const response = await request.get('/')
    const headers = response.headers()
    expect(headers['x-frame-options']).toBe('DENY')
    expect(headers['x-content-type-options']).toBe('nosniff')
    expect(headers['referrer-policy']).toBe('same-origin')
    expect(headers['x-powered-by']).toBeUndefined()
  })
})

test.describe('signed in as an unapproved user', () => {
  test.use({storageState: storageStatePath('outsider')})

  test('unknown and forbidden artists render identically', async ({page}) => {
    const forbidden = await page.goto('/test-artist')
    const forbiddenHtml = await page.locator('main').innerHTML()
    const unknown = await page.goto(`/${UNKNOWN}`)
    const unknownHtml = await page.locator('main').innerHTML()
    expect(forbidden?.status()).toBe(unknown?.status())
    expect(forbiddenHtml).toBe(unknownHtml)
    await expect(page.getByRole('heading', {name: 'This page isn’t available'})).toBeVisible()
    await expect(page).toHaveTitle('Welcome to Vydia')
  })

  test('an old URL does not redirect for someone without access', async ({page}) => {
    await page.goto('/test-renamed-original')
    await expect(page).toHaveURL('/test-renamed-original')
    await expect(page.getByRole('heading', {name: 'This page isn’t available'})).toBeVisible()
  })
})

test.describe('signed in as an approved user', () => {
  test.use({storageState: storageStatePath('approved')})

  test('sees the intro and resource cards', async ({page}) => {
    await page.goto('/test-artist')
    await expect(page.getByText('Welcome to Vydia!')).toBeVisible()
    await expect(page.getByRole('heading', {name: 'Vydia Platform Resources'})).toBeVisible()
    await expect(page.getByText(/^Added on /).first()).toBeVisible()
  })

  test('an old URL redirects to the current one', async ({page}) => {
    await page.goto('/test-renamed-original')
    await expect(page).toHaveURL('/test-renamed')
    await expect(page.getByRole('heading', {name: 'Vydia Platform Resources'})).toBeVisible()
  })

  test('link cards open in a new tab without leaking the opener', async ({page}) => {
    await page.goto('/test-artist')
    const cards = page.locator('section[aria-labelledby] a')
    expect(await cards.count()).toBeGreaterThan(0)
    for (const card of await cards.all()) {
      await expect(card).toHaveAttribute('target', '_blank')
      await expect(card).toHaveAttribute('rel', 'noopener noreferrer')
    }
  })

  test('the video dialog opens, plays, closes on Escape, and returns focus', async ({page}) => {
    await page.goto('/test-artist')
    const card = page.locator('section[aria-labelledby] button[aria-haspopup="dialog"]').first()
    await card.click()
    const dialog = page.locator('dialog[open]')
    await expect(dialog).toBeVisible()
    await expect.poll(() => dialog.locator('video').evaluate((video: HTMLVideoElement) => video.paused)).toBe(false)
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)
    await expect
      .poll(() =>
        page
          .locator('dialog video')
          .first()
          .evaluate((video: HTMLVideoElement) => video.paused),
      )
      .toBe(true)
    await expect(card).toBeFocused()
  })
})
