import {expect, test} from '@playwright/test'
import {E2E_USERS} from './users'

test.describe('sign-in page', () => {
  test('offers Google and an email link, and no password', async ({page}) => {
    await page.goto('/login?next=%2Ftest-artist')
    await expect(page.getByRole('button', {name: 'Continue with Google'})).toBeVisible()
    await expect(page.getByRole('button', {name: 'Email me a sign-in link'})).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('a known-but-unapproved and a made-up email get the same answer', async ({page}) => {
    const answers: string[] = []
    for (const email of [E2E_USERS.outsider, `nobody-${Date.now()}@example.com`]) {
      await page.goto('/login')
      await page.getByPlaceholder('Email').fill(email)
      await page.getByRole('button', {name: 'Email me a sign-in link'}).click()
      const status = page.getByRole('status')
      await expect(status).toContainText(email)
      answers.push(((await status.textContent()) ?? '').replace(email, '<email>'))
    }
    expect(answers[0]).toBe(answers[1])
    await expect(page.getByRole('button', {name: /^Resend link in \d+s$/})).toBeDisabled()
  })

  test('"Use a different email" starts over', async ({page}) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(`nobody-${Date.now()}@example.com`)
    await page.getByRole('button', {name: 'Email me a sign-in link'}).click()
    await page.getByRole('button', {name: 'Use a different email'}).click()
    await expect(page.getByPlaceholder('Email')).toHaveValue('')
  })

  test('Google goes to accounts.google.com via Supabase', async ({page}) => {
    await page.goto('/login?next=%2Ftest-artist')
    const google = page.waitForRequest((request) => request.url().startsWith('https://accounts.google.com/'))
    await page.getByRole('button', {name: 'Continue with Google'}).click()
    expect((await google).url()).toContain('prompt=select_account')
  })

  test('a bad or used link asks for a new one', async ({page}) => {
    await page.goto('/auth/confirm?token_hash=not-a-real-token&type=email&redirect_to=/test-artist')
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page).toHaveURL('/login?error=link&next=%2Ftest-artist')
    await expect(page.locator('p[role="alert"]')).toContainText('invalid, expired, or already used')
  })

  test('opening a link does not sign in until Continue is pressed', async ({request}) => {
    const response = await request.get('/auth/confirm?token_hash=anything&type=email', {maxRedirects: 0})
    expect(response.status()).toBe(200)
    expect(response.headers()['set-cookie'] ?? '').not.toContain('sb-')
  })
})
