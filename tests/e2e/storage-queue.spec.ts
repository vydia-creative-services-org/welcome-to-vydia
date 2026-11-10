import {expect, test} from '@playwright/test'

const adminToken = process.env.E2E_ADMIN_ACCESS_TOKEN
const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

test.describe('storage cleanup queue through the REST API', () => {
  test.skip(
    !adminToken || !apiUrl || !publishableKey,
    'needs E2E_ADMIN_ACCESS_TOKEN, an admin (Google-method) access token',
  )

  test('take_storage_garbage runs under pg_safeupdate', async ({request}) => {
    const response = await request.post(`${apiUrl}/rest/v1/rpc/take_storage_garbage`, {
      headers: {
        apikey: publishableKey ?? '',
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      data: {},
    })
    expect(response.status()).toBe(200)
    expect(Array.isArray(await response.json())).toBe(true)
  })
})
