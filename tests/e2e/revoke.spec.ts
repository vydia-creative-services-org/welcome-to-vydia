import {expect, test} from '@playwright/test'
import {adminClient} from './admin-client'
import {E2E_SLUGS, E2E_USERS, storageStatePath} from './users'

test.describe.configure({mode: 'serial'})

test.describe('removing an email', () => {
  test.use({storageState: storageStatePath('aux2')})

  test('revokes access on the next page load, even though the session is still valid', async ({page}) => {
    const supabase = adminClient()
    const {data: artist} = await supabase.from('artists').select('id').eq('slug', E2E_SLUGS.a).single()
    if (!artist) throw new Error('Fixtures are missing: run npm run e2e:setup.')

    await page.goto(`/${E2E_SLUGS.a}`)
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()

    await supabase.from('artist_emails').delete().eq('artist_id', artist.id).eq('email', E2E_USERS.aux2)
    try {
      await page.reload()
      await expect(page.getByPlaceholder('Enter your email')).toBeVisible()
      await expect(page.getByRole('region', {name: 'Resources'})).toHaveCount(0)
    } finally {
      await supabase
        .from('artist_emails')
        .insert({artist_id: artist.id, email: E2E_USERS.aux2, label: 'Alt', is_primary: false})
    }

    await page.reload()
    await expect(page.getByRole('region', {name: 'Resources'})).toBeVisible()
  })
})
