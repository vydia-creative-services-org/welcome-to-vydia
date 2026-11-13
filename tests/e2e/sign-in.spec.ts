import {expect, test} from '@playwright/test'
import {adminClient, confirmPath, hashedToken, userEmails} from './admin-client'
import {E2E_SLUGS, E2E_USERS} from './users'

const NOT_APPROVED =
  'This email isn’t approved to view this page. Make sure you’re using the URL provided by Vydia label services, or contact them if you’re having trouble.'

test.describe('enter your email', () => {
  test('a wrong email and any email on an unknown slug get the identical message, and no user is created', async ({
    page,
  }) => {
    const stranger = `nobody-${Date.now()}@example.com`
    const answers: string[] = []
    for (const slug of [E2E_SLUGS.a, `does-not-exist-${Date.now()}`]) {
      await page.goto(`/${slug}`)
      await page.getByPlaceholder('Enter your email').fill(stranger)
      await page.getByRole('button', {name: 'Continue'}).click()
      const message = page.locator('#enter-email-message')
      await expect(message).toBeVisible()
      answers.push((await message.textContent()) ?? '')
      await expect(page.getByPlaceholder('Enter your email')).toHaveValue(stranger)
    }
    expect(answers).toEqual([NOT_APPROVED, NOT_APPROVED])
    expect(await userEmails()).not.toContain(stranger)
  })

  test('a real client email on the wrong client’s slug is also not approved', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.b}`)
    await page.getByPlaceholder('Enter your email').fill(E2E_USERS.clientA)
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.locator('#enter-email-message')).toHaveText(NOT_APPROVED)
  })

  test('an approved auxiliary email sees the sent state and a disabled resend countdown', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await page.getByPlaceholder('Enter your email').fill(E2E_USERS.aux2.toUpperCase())
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.getByText('Email sent, check your inbox')).toBeVisible()
    await expect(page.getByPlaceholder('Enter your email')).toHaveCount(0)
    const resend = page.getByRole('button', {name: /^Resend email \(\d+s\)$/})
    await expect(resend).toBeDisabled()
  })

  test('a malformed email asks for a full address without calling the server', async ({page}) => {
    await page.goto(`/${E2E_SLUGS.a}`)
    await page.getByPlaceholder('Enter your email').fill('not-an-email')
    await page.getByRole('button', {name: 'Continue'}).click()
    await expect(page.getByPlaceholder('Enter your email')).toBeFocused()
  })
})

test.describe('the magic link', () => {
  test('opening a fresh link signs in directly and lands on the client page', async ({request, page}) => {
    const token = await hashedToken(E2E_USERS.clientA)
    const response = await request.get(confirmPath(token, `/${E2E_SLUGS.a}`), {maxRedirects: 0})
    expect(response.status()).toBe(307)
    expect(response.headers().location).toContain(`/${E2E_SLUGS.a}`)
    expect(response.headers()['set-cookie'] ?? '').toContain('sb-')

    await page.goto(confirmPath(await hashedToken(E2E_USERS.clientA), `/${E2E_SLUGS.a}`))
    await expect(page).toHaveURL(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
  })

  test('a bogus link goes to the expired screen with a way back to the slug', async ({page}) => {
    await page.goto(confirmPath('not-a-real-token', `/${E2E_SLUGS.a}`))
    await expect(page).toHaveURL(`/auth/expired?next=%2F${E2E_SLUGS.a}`)
    await expect(page.getByRole('heading', {name: 'This link has expired'})).toBeVisible()
    await expect(page.getByRole('link', {name: 'Send a new link'})).toHaveAttribute('href', `/${E2E_SLUGS.a}`)
  })

  test('a missing token also goes to the expired screen', async ({request}) => {
    const response = await request.get('/auth/confirm', {maxRedirects: 0})
    expect(response.status()).toBe(307)
    expect(response.headers().location).toContain('/auth/expired')
  })

  test('a used link opened in another browser is expired', async ({browser}) => {
    const token = await hashedToken(E2E_USERS.manager)
    const first = await browser.newContext()
    await (await first.newPage()).goto(confirmPath(token, `/${E2E_SLUGS.a}`))
    const second = await browser.newContext()
    const page = await second.newPage()
    await page.goto(confirmPath(token, `/${E2E_SLUGS.a}`))
    await expect(page.getByRole('heading', {name: 'This link has expired'})).toBeVisible()
    await first.close()
    await second.close()
  })

  test('signing in with another email replaces the earlier session', async ({browser}) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(confirmPath(await hashedToken(E2E_USERS.clientB), `/${E2E_SLUGS.b}`))
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await page.goto(confirmPath(await hashedToken(E2E_USERS.clientA), `/${E2E_SLUGS.a}`))
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
    await page.goto(`/${E2E_SLUGS.b}`)
    await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
    await context.close()
  })
})

test.describe('the permanent link', () => {
  async function openPath(email: string, slug: string) {
    const {data, error} = await adminClient().rpc('access_link_for', {p_slug: slug, p_email: email})
    if (error || !data[0]) throw error ?? new Error(`No link for ${email} on ${slug}`)
    return `/auth/open?t=${data[0].token}`
  }

  test('signs in directly, and keeps working in other browsers', async ({browser}) => {
    const path = await openPath(E2E_USERS.manager, E2E_SLUGS.a)
    for (let run = 0; run < 2; run++) {
      const context = await browser.newContext()
      const page = await context.newPage()
      await page.goto(path)
      await expect(page).toHaveURL(`/${E2E_SLUGS.a}`)
      await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
      await context.close()
    }
  })

  test('a made-up or malformed token shows the inactive screen', async ({page}) => {
    for (const token of ['f'.repeat(64), 'nope']) {
      await page.goto(`/auth/open?t=${token}`)
      await expect(page).toHaveURL('/auth/inactive')
      await expect(page.getByRole('heading', {name: 'This Link Is No Longer Active'})).toBeVisible()
    }
  })
})

test('the fixtures use the admin client on the expected project', async () => {
  const {data} = await adminClient().from('clients').select('slug').in('slug', [E2E_SLUGS.a, E2E_SLUGS.b])
  expect(data?.map((row) => row.slug).sort()).toEqual([E2E_SLUGS.a, E2E_SLUGS.b])
})
