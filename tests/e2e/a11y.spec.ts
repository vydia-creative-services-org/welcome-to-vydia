import AxeBuilder from '@axe-core/playwright'
import {expect, test, type Page} from '@playwright/test'
import {storageStatePath} from './users'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({page}).withTags(WCAG_TAGS).exclude('nextjs-portal').analyze()
  const summary = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  )
  expect(summary).toEqual([])
}

test.describe('accessibility, signed out', () => {
  test('instructions page', async ({page}) => {
    await page.goto('/')
    await expectNoViolations(page)
  })

  test('sign-in page, with an error and after sending a link', async ({page}) => {
    await page.goto('/login?next=%2Ftest-artist&error=link')
    await expectNoViolations(page)
    await page.getByPlaceholder('Email').fill(`nobody-${Date.now()}@example.com`)
    await page.getByRole('button', {name: 'Email me a sign-in link'}).click()
    await expect(page.getByRole('heading', {name: 'Check your email'})).toBeVisible()
    await expectNoViolations(page)
  })

  test('finish signing in page', async ({page}) => {
    await page.goto('/auth/confirm?token_hash=x&type=email')
    await expect(page.getByRole('heading', {name: 'Finish signing in'})).toBeVisible()
    await expectNoViolations(page)
  })
})

test.describe('accessibility, unapproved user', () => {
  test.use({storageState: storageStatePath('outsider')})

  test('no-access page', async ({page}) => {
    await page.goto('/test-artist')
    await expect(page.getByRole('heading', {name: 'This page isn’t available'})).toBeVisible()
    await expectNoViolations(page)
  })
})

test.describe('accessibility, approved user', () => {
  test.use({storageState: storageStatePath('approved')})

  test('artist page with every card type', async ({page}) => {
    await page.goto('/test-artist')
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await expectNoViolations(page)
  })

  test('open video dialog', async ({page}) => {
    await page.goto('/test-artist')
    await page.locator('section[aria-label="Resources"] button[aria-haspopup="dialog"]').first().click()
    await expect(page.locator('dialog[open]')).toBeVisible()
    await expectNoViolations(page)
  })

  test('keyboard only: cards are reachable and open with Enter', async ({page, context}) => {
    await page.goto('/test-artist')
    const firstLink = page.locator('section[aria-label="Resources"] a').first()
    for (let i = 0; i < 40 && !(await firstLink.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab')
    }
    await expect(firstLink).toBeFocused()
    const popup = context.waitForEvent('page')
    await page.keyboard.press('Enter')
    await (await popup).close()
    const videoCard = page.locator('section[aria-label="Resources"] button[aria-haspopup="dialog"]').first()
    await videoCard.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog[open]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(videoCard).toBeFocused()
  })

  test('every cover image has alt text (empty for decorative)', async ({page}) => {
    await page.goto('/test-artist')
    const missing = await page.locator('main img:not([alt])').count()
    expect(missing).toBe(0)
  })
})
