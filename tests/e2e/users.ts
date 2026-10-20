export const E2E_USERS = {
  approved: 'e2e-approved@example.com',
  outsider: 'e2e-outsider@example.com',
} as const

export type E2EPersona = keyof typeof E2E_USERS

export const E2E_PERSONAS: E2EPersona[] = ['approved', 'outsider']

export const storageStatePath = (persona: E2EPersona) => `tests/e2e/.auth/${persona}.json`

export function e2ePassword(): string {
  const password = process.env.E2E_PASSWORD
  if (!password) throw new Error('Set E2E_PASSWORD (see README, "End-to-end tests").')
  return password
}
