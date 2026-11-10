const TIME_ZONE = 'America/New_York'

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const timeFormat = new Intl.DateTimeFormat('en-US', {hour: 'numeric', minute: '2-digit', timeZone: TIME_ZONE})

export const formatDate = (iso: string) => dateFormat.format(new Date(iso))

export function formatAddedOn(iso: string) {
  const date = new Date(iso)
  return `Added on ${dateFormat.format(date)} at ${timeFormat.format(date)}`
}
