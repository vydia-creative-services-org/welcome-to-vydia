export const E2E_USERS = {
  artistA: 'delivered+a@resend.dev',
  manager: 'delivered+mgr@resend.dev',
  aux2: 'delivered+a2@resend.dev',
  artistB: 'delivered+b@resend.dev',
} as const

export type E2EPersona = keyof typeof E2E_USERS

export const E2E_PERSONAS: E2EPersona[] = ['artistA', 'manager', 'aux2', 'artistB']

export const E2E_SLUGS = {a: 'e2e-artist-a', b: 'e2e-artist-b'} as const

export const E2E_NAMES = {a: 'E2E Artist A', b: 'E2E Artist B'} as const

export const E2E_TITLES = {
  mainOne: 'E2E Getting Started One',
  mainTwo: 'E2E Getting Started Two',
  exclusive: 'E2E A Only',
  video: 'E2E A Video',
} as const

export const storageStatePath = (persona: E2EPersona) => `tests/e2e/.auth/${persona}.json`
