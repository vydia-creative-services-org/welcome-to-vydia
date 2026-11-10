import {existsSync} from 'node:fs'
import {chromium, type FullConfig} from '@playwright/test'
import {confirmPath, hashedToken} from './admin-client'
import {E2E_PERSONAS, E2E_USERS, storageStatePath} from './users'

export default async function globalSetup(config: FullConfig) {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local')
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:3000'
  const extraHTTPHeaders = config.projects[0]?.use.extraHTTPHeaders
  const browser = await chromium.launch()
  for (const persona of E2E_PERSONAS) {
    const context = await browser.newContext({baseURL, extraHTTPHeaders})
    const page = await context.newPage()
    await page.goto(confirmPath(await hashedToken(E2E_USERS[persona]), '/'))
    await page.waitForURL((url) => url.pathname === '/', {timeout: 30_000})
    await context.storageState({path: storageStatePath(persona)})
    await context.close()
  }
  await browser.close()
}
