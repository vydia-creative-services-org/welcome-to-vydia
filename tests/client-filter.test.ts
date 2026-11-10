import {describe, expect, it} from 'vitest'
import {filterClients, type FilterableClient} from '@/lib/admin/client-filter'

const rows: (FilterableClient & {id: string})[] = [
  {id: '1', name: 'Lil Example', allEmails: ['lil@example.com'], owner: 'Mason', isMine: true},
  {id: '2', name: 'Big Name', allEmails: ['big@example.com', 'manager@mgmt.com'], owner: 'Erica', isMine: false},
  {id: '3', name: 'Orphan Act', allEmails: ['orphan@example.com'], owner: null, isMine: false},
]

const ids = (found: {id: string}[]) => found.map((row) => row.id)

describe('filterClients', () => {
  it('returns everything for the all scope with no query', () => {
    expect(ids(filterClients(rows, {query: '', scope: 'all'}))).toEqual(['1', '2', '3'])
  })

  it('limits the mine scope to the caller’s clients', () => {
    expect(ids(filterClients(rows, {query: '', scope: 'mine'}))).toEqual(['1'])
  })

  it('limits the unassigned scope to clients without an owner', () => {
    expect(ids(filterClients(rows, {query: '', scope: 'unassigned'}))).toEqual(['3'])
  })

  it('matches names case-insensitively and ignores surrounding space', () => {
    expect(ids(filterClients(rows, {query: '  BIG ', scope: 'all'}))).toEqual(['2'])
  })

  it('matches any email on the client', () => {
    expect(ids(filterClients(rows, {query: 'mgmt.com', scope: 'all'}))).toEqual(['2'])
  })

  it('matches the owner name', () => {
    expect(ids(filterClients(rows, {query: 'erica', scope: 'all'}))).toEqual(['2'])
  })

  it('combines the scope and the query', () => {
    expect(ids(filterClients(rows, {query: 'big', scope: 'mine'}))).toEqual([])
  })
})
