export type ClientScope = 'all' | 'mine' | 'unassigned'

export type FilterableClient = {
  name: string
  allEmails: string[]
  owner: string | null
  isMine: boolean
}

export function filterClients<Row extends FilterableClient>(rows: Row[], filter: {query: string; scope: ClientScope}) {
  const needle = filter.query.trim().toLowerCase()
  return rows.filter((row) => {
    if (filter.scope === 'mine' && !row.isMine) return false
    if (filter.scope === 'unassigned' && row.owner !== null) return false
    if (!needle) return true
    return (
      row.name.toLowerCase().includes(needle) ||
      row.allEmails.some((email) => email.includes(needle)) ||
      (row.owner?.toLowerCase().includes(needle) ?? false)
    )
  })
}
