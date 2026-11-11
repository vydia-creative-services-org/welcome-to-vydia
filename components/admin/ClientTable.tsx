'use client'
import Link from 'next/link'
import {useMemo, useState} from 'react'
import {filterClients, type ClientScope} from '@/lib/admin/client-filter'
import {formatDate} from '@/lib/format'
import {CopyLinkButton} from './CopyLinkButton'
import {OpenLinkButton} from './OpenLinkButton'
import controls from './controls.module.css'
import styles from './ClientTable.module.css'

export type ClientRow = {
  id: string
  name: string
  slug: string
  createdAt: string
  primaryEmail: string
  auxCount: number
  allEmails: string[]
  owner: string | null
  isMine: boolean
}

const SCOPES: {value: ClientScope; label: string}[] = [
  {value: 'mine', label: 'Mine'},
  {value: 'all', label: 'All'},
  {value: 'unassigned', label: 'Unassigned'},
]

export function ClientTable({rows, showOwner}: {rows: ClientRow[]; showOwner: boolean}) {
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<ClientScope>(showOwner ? 'mine' : 'all')

  const visible = useMemo(() => filterClients(rows, {query, scope}), [rows, query, scope])

  if (rows.length === 0) {
    return (
      <div className={`${controls.card} ${styles.empty}`}>
        <p className={styles.emptyTitle}>{showOwner ? 'No clients yet' : 'No clients assigned to you yet'}</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tools}>
        <input
          type="search"
          value={query}
          aria-label="Search clients"
          placeholder="Search clients"
          onChange={(event) => setQuery(event.target.value)}
          className={`${controls.input} ${styles.search}`}
        />
        {showOwner && (
          <div role="group" aria-label="Show clients" className={styles.scopes}>
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                className={controls.button}
                aria-pressed={scope === option.value}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={`${controls.card} ${styles.card}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Email</th>
              {showOwner && <th scope="col">Owner</th>}
              <th scope="col">Created</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/clients/${row.id}`} className={styles.name}>
                    {row.name}
                  </Link>
                </td>
                <td className={styles.email}>
                  {row.primaryEmail}
                  {row.auxCount > 0 && <span className={controls.hint}> +{row.auxCount}</span>}
                </td>
                {showOwner && (
                  <td className={styles.owner}>{row.owner ?? <span className={controls.hint}>Unassigned</span>}</td>
                )}
                <td className={styles.date}>{formatDate(row.createdAt)}</td>
                <td className={styles.copy}>
                  <div className={styles.actions}>
                    <CopyLinkButton slug={row.slug} />
                    <OpenLinkButton slug={row.slug} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className={`${controls.hint} ${styles.none}`}>
            {query.trim() ? `No clients match “${query}”.` : 'No clients in this view.'}
          </p>
        )}
      </div>
    </div>
  )
}
