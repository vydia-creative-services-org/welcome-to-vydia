import {expect, test, type Page} from '@playwright/test'
import {E2E_SLUGS, E2E_TITLES, storageStatePath} from './users'

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)

test.describe('enter your email', () => {
  test('renders, fits the screen, and shows the not-approved message with the input kept', async ({page}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/${E2E_SLUGS.a}`)
    const input = page.getByPlaceholder('Enter your email')
    await expect(input).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)

    const stranger = `nobody-${Date.now()}@example.com`
    await input.fill(stranger)
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.locator('#enter-email-message')).toBeVisible()
    await expect(input).toHaveValue(stranger)
    expect(await noHorizontalScroll(page)).toBe(true)
    expect(errors).toEqual([])
  })
})

test.describe('resources page', () => {
  test.use({storageState: storageStatePath('artistA')})

  test('carousel, grid, and video dialog work', async ({page}) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await expect(page.locator('h2[aria-live]')).toBeVisible()
    expect(await noHorizontalScroll(page)).toBe(true)

    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    await expect(page.getByRole('heading', {name: 'Your Releases'})).toBeVisible()
    await page.waitForTimeout(1200)
    expect(await noHorizontalScroll(page)).toBe(true)

    const card = page.getByRole('button', {name: new RegExp(E2E_TITLES.video)})
    await card.click()
    await expect(page.locator('dialog[open]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog[open]')).toHaveCount(0)

    await page.getByRole('button', {name: 'Switch to carousel view'}).click()
    await expect(page.locator('h2[aria-live]')).toBeVisible()
    expect(errors).toEqual([])
  })
})

test('admin login renders with the Google button', async ({page}) => {
  await page.goto('/admin/login')
  await expect(page.getByRole('button', {name: 'Sign in with Google'})).toBeVisible()
  expect(await noHorizontalScroll(page)).toBe(true)
})
