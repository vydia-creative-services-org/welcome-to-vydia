import AxeBuilder from '@axe-core/playwright'
import {expect, test, type Page} from '@playwright/test'
import {E2E_SLUGS, E2E_USERS, storageStatePath} from './users'

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

  test('enter your email: idle, not approved, and sent', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await expectNoViolations(page)

    await page.getByPlaceholder('Enter your email').fill(`nobody-${Date.now()}@example.com`)
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.locator('#enter-email-message')).toBeVisible()
    await expectNoViolations(page)

    await page.getByPlaceholder('Enter your email').fill(E2E_USERS.aux2)
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.getByText('Email sent, check your inbox')).toBeVisible()
    await expectNoViolations(page)
  })

  test('link expired', async ({page}) => {
    await page.goto(`/auth/expired?next=%2F${E2E_SLUGS.a}`)
    await expectNoViolations(page)
  })

  test('admin login', async ({page}) => {
    await page.goto('/admin/login?error=no-access')
    await expectNoViolations(page)
  })
})

test.describe('accessibility, resources page', () => {
  test.use({storageState: storageStatePath('clientA')})

  test('carousel and grid views', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await expectNoViolations(page)
    await page.getByRole('button', {name: 'Switch to grid view'}).click()
    await expect(page.getByRole('heading', {name: 'Your Releases'})).toBeVisible()
    await page.waitForTimeout(1000)
    await expectNoViolations(page)
  })
})

test.describe('accessibility, admin login in dark mode', () => {
  test.use({colorScheme: 'dark'})

  test('admin login', async ({page}) => {
    await page.goto('/admin/login?error=no-access')
    await expectNoViolations(page)
  })
})

test('a saved admin theme is applied before paint', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('vydia-admin-theme', 'dark'))
  await page.goto('/admin/login')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})
