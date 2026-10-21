const LOGIN_ERRORS = {
  link: 'That sign-in link is invalid, expired, or already used. Enter your email to get a new one.',
  google: 'Google sign-in isn’t available right now. Please use your email instead.',
  'not-approved':
    'That Google account doesn’t have access to any Vydia pages. Sign in with the email your Vydia representative has on file for you.',
}

export const loginErrorMessage = (raw: string | string[] | undefined): string | null =>
  Object.entries(LOGIN_ERRORS).find(([key]) => key === raw)?.[1] ?? null
