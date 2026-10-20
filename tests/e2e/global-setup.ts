import {chromium, type FullConfig} from '@playwright/test'
import {E2E_PERSONAS, E2E_USERS, e2ePassword, storageStatePath} from './users'

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const extraHTTPHeaders = config.projects[0]?.use.extraHTTPHeaders
  const password = e2ePassword()
  const browser = await chromium.launch()
  for (const persona of E2E_PERSONAS) {
    const context = await browser.newContext({baseURL, extraHTTPHeaders})
    const page = await context.newPage()
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill(E2E_USERS[persona])
    await page.getByPlaceholder('Password').fill(password)
    await page.getByRole('button', {name: 'Sign in', exact: true}).click()
    await page.waitForURL((url) => url.pathname === '/', {timeout: 30_000})
    await context.storageState({path: storageStatePath(persona)})
    await context.close()
  }
  await browser.close()
}
