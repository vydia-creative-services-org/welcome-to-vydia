/**
 * The header greeting, also used as the page title. Pages without a client show the plain welcome.
 * The header pads the divider with non-breaking spaces; the title keeps it tight.
 */
export const greeting = (clientName?: string, {spaced = false} = {}) =>
  clientName ? `${clientName}${spaced ? '   |   ' : ' | '}Welcome to Vydia` : 'Welcome to Vydia'
