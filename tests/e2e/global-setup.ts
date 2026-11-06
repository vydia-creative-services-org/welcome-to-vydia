import {existsSync} from 'node:fs'
import {chromium, type FullConfig} from '@playwright/test'
import {E2E_PERSONAS, E2E_USERS, storageStatePath} from './users'

async function hashedToken(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  const response = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({type: 'magiclink', email}),
  })
  if (!response.ok) throw new Error(`generate_link for ${email}: ${response.status} ${await response.text()}`)
  const {hashed_token: token}: {hashed_token: string} = await response.json()
  return token
}

export default async function globalSetup(config: FullConfig) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local')
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const extraHTTPHeaders = config.projects[0]?.use.extraHTTPHeaders
  const browser = await chromium.launch()
  for (const persona of E2E_PERSONAS) {
    const context = await browser.newContext({baseURL, extraHTTPHeaders})
    const page = await context.newPage()
    await page.goto(`/auth/confirm?token_hash=${await hashedToken(E2E_USERS[persona])}&type=email&redirect_to=/`)
    await page.getByRole('button', {name: 'Continue'}).click()
    await page.waitForURL((url) => url.pathname === '/', {timeout: 30_000})
    await context.storageState({path: storageStatePath(persona)})
    await context.close()
  }
  await browser.close()
}
