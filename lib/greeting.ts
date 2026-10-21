/** The header greeting, also used as the page title. Pages without an artist show the plain welcome. */
export const greeting = (artistName?: string) =>
  artistName ? `${artistName} | Welcome to Vydia` : 'Welcome to Vydia'
