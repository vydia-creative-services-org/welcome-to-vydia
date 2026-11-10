import {expect, test} from '@playwright/test'
import {E2E_SLUGS, storageStatePath} from './users'

test.describe('signed out', () => {
  test('every admin page redirects to the admin login', async ({page}) => {
    for (const path of ['/admin', '/admin/resources', '/admin/clients/new']) {
      await page.goto(path)
      await expect(page).toHaveURL('/admin/login')
    }
  })

  test('the login page offers only Google, no email or password', async ({page}) => {
    await page.goto('/admin/login')
    await expect(page.getByRole('button', {name: 'Sign in with Google'})).toBeVisible()
    await expect(page.locator('input[type="email"], input[type="password"]')).toHaveCount(0)
    await expect(page.locator('main').getByRole('button')).toHaveCount(1)
  })

  test('the login page shows the no-access message only for the known error', async ({page}) => {
    await page.goto('/admin/login?error=no-access')
    await expect(page.getByRole('alert').filter({hasText: 'You don’t have access.'})).toBeVisible()
    await page.goto('/admin/login?error=%3Cscript%3E')
    await expect(page.getByRole('alert').filter({hasText: 'You don’t have access.'})).toHaveCount(0)
  })

  test('the callback sends every failure to the no-access message', async ({request}) => {
    for (const query of ['', '?code=bogus', '?error=access_denied&error_description=Not+approved']) {
      const response = await request.get(`/admin/auth/callback${query}`, {maxRedirects: 0})
      expect(response.status()).toBe(307)
      expect(response.headers().location).toContain('/admin/login?error=no-access')
    }
  })

  test('starting Google sign-in goes to Google with the account picker', async ({page}) => {
    await page.goto('/admin/login')
    const google = page.waitForRequest((request) => request.url().startsWith('https://accounts.google.com/'))
    await page.getByRole('button', {name: 'Sign in with Google'}).click()
    expect((await google).url()).toContain('prompt=select_account')
  })
})

test.describe('signed in as a client, not an admin', () => {
  test.use({storageState: storageStatePath('manager')})

  test('the panel shows "You don’t have access." and the client page keeps working', async ({page}) => {
    await page.goto('/admin')
    await expect(page).toHaveURL('/admin/login?error=no-access')
    await expect(page.getByRole('alert').filter({hasText: 'You don’t have access.'})).toBeVisible()
    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
  })

  test('the admin routes never serve data to a magic-link session', async ({page}) => {
    for (const path of ['/admin/resources', '/admin/clients/new']) {
      await page.goto(path)
      await expect(page).toHaveURL('/admin/login?error=no-access')
    }
  })
})
