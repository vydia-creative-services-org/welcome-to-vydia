/**
 * The header greeting, also used as the page title. Pages without an artist show the plain welcome.
 * The header pads the divider with non-breaking spaces; the title keeps it tight.
 */
export const greeting = (artistName?: string, {spaced = false} = {}) =>
  artistName ? `${artistName}${spaced ? '   |   ' : ' | '}Welcome to Vydia` : 'Welcome to Vydia'
