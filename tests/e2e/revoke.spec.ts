import {expect, test} from '@playwright/test'
import {adminClient} from './admin-client'
import {E2E_SLUGS, E2E_USERS, storageStatePath} from './users'

test.describe.configure({mode: 'serial'})

test.describe('removing an email', () => {
  test.use({storageState: storageStatePath('aux2')})

  test('revokes access on the next page load, even though the session is still valid', async ({page}) => {
    const supabase = adminClient()
    const {data: client} = await supabase.from('clients').select('id').eq('slug', E2E_SLUGS.a).single()
    if (!client) throw new Error('Fixtures are missing: run npm run e2e:setup.')

    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()

    await supabase.from('client_emails').delete().eq('client_id', client.id).eq('email', E2E_USERS.aux2)
    try {
      await page.reload()
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
      await expect(page.getByRole('region', {name: 'Resources'})).toHaveCount(0)
    } finally {
      await supabase
        .from('client_emails')
        .insert({client_id: client.id, email: E2E_USERS.aux2, label: 'Alt', is_primary: false})
    }

    await page.reload()
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
  })
})
