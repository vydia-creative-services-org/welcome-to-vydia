'use client'
import Link from 'next/link'
import {useMemo, useState} from 'react'
import {formatDate} from '@/lib/format'
import {CopyLinkButton} from './CopyLinkButton'
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
}

export function ClientTable({rows}: {rows: ClientRow[]}) {
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(
      (row) => row.name.toLowerCase().includes(needle) || row.allEmails.some((email) => email.includes(needle)),
    )
  }, [rows, query])

  if (rows.length === 0) {
    return (
      <div className={`${controls.card} ${styles.empty}`}>
        <p className={styles.emptyTitle}>No clients yet</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <input
        type="search"
        value={query}
        aria-label="Search clients"
        placeholder="Search clients"
        onChange={(event) => setQuery(event.target.value)}
        className={`${controls.input} ${styles.search}`}
      />
      <div className={`${controls.card} ${styles.card}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Client</th>
              <th scope="col">Email</th>
              <th scope="col">Created</th>
              <th scope="col">
                <span className="visually-hidden">Link</span>
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
                <td className={styles.date}>{formatDate(row.createdAt)}</td>
                <td className={styles.copy}>
                  <CopyLinkButton slug={row.slug} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className={`${controls.hint} ${styles.none}`}>No clients match “{query}”.</p>}
      </div>
    </div>
  )
}
