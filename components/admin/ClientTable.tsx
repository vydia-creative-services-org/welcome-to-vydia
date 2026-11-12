'use client'
import {Plus, Search, Users} from 'lucide-react'
import Link from 'next/link'
import {useEffect, useMemo, useRef, useState} from 'react'
import {filterClients, type ClientScope} from '@/lib/admin/client-filter'
import {cx} from '@/lib/cx'
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
  const search = useRef<HTMLInputElement>(null)

  const visible = useMemo(() => filterClients(rows, {query, scope}), [rows, query, scope])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]'))
        return
      event.preventDefault()
      search.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (rows.length === 0) {
    return (
      <div className={cx(controls.card, styles.empty)}>
        <Users aria-hidden size={24} className={styles.emptyIcon} />
        <h2 className={styles.emptyTitle}>{showOwner ? 'No Clients Yet' : 'No Clients Assigned to You Yet'}</h2>
        <div>
          <Link href="/admin/clients/new" className={cx(controls.button, controls.primary)}>
            <Plus aria-hidden size={14} />
            New client
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.tools}>
        <label className={cx(controls.inputGroup, styles.search)}>
          <span className={controls.affix} aria-hidden>
            <Search size={14} />
          </span>
          <input
            ref={search}
            type="search"
            value={query}
            aria-label="Search clients"
            placeholder="Search clients"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {showOwner && (
          <div role="group" aria-label="Show clients" className={controls.segmented}>
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={scope === option.value}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className={cx(controls.card, styles.card)}>
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
                <td className={styles.actionsCell}>
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
          <p className={cx(controls.hint, styles.none)}>
            {query.trim() ? `No clients match “${query}”.` : 'No clients in this view.'}
          </p>
        )}
      </div>
    </div>
  )
}
