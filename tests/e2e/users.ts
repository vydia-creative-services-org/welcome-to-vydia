export const E2E_USERS = {
  approved: 'e2e-approved@example.com',
  outsider: 'e2e-outsider@example.com',
} as const

export type E2EPersona = keyof typeof E2E_USERS

export const E2E_PERSONAS: E2EPersona[] = ['approved', 'outsider']

export const storageStatePath = (persona: E2EPersona) => `tests/e2e/.auth/${persona}.json`
