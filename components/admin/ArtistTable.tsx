'use client'
import Link from 'next/link'
import {useMemo, useState} from 'react'
import {formatDate} from '@/lib/format'
import {CopyLinkButton} from './CopyLinkButton'
import controls from './controls.module.css'
import styles from './ArtistTable.module.css'

export type ArtistRow = {
  id: string
  name: string
  slug: string
  createdAt: string
  primaryEmail: string
  auxCount: number
  allEmails: string[]
}

export function ArtistTable({rows}: {rows: ArtistRow[]}) {
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
        <p className={styles.emptyTitle}>No artists yet</p>
        <p className={controls.hint}>Create the first artist to get a Welcome link you can send.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrap}>
      <div className={controls.field}>
        <label htmlFor="artist-search" className="visually-hidden">
          Search artists by name or email
        </label>
        <input
          id="artist-search"
          type="search"
          value={query}
          placeholder="Search by name or email"
          onChange={(event) => setQuery(event.target.value)}
          className={`${controls.input} ${styles.search}`}
        />
      </div>
      <div className={`${controls.card} ${styles.card}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Artist</th>
              <th scope="col">Primary email</th>
              <th scope="col" className={styles.number}>
                Aux emails
              </th>
              <th scope="col">Slug</th>
              <th scope="col">Link</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/artists/${row.id}`} className={styles.name}>
                    {row.name}
                  </Link>
                </td>
                <td className={styles.email}>{row.primaryEmail}</td>
                <td className={styles.number}>{row.auxCount}</td>
                <td>
                  <code>{row.slug}</code>
                </td>
                <td>
                  <CopyLinkButton slug={row.slug} />
                </td>
                <td className={styles.date}>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className={`${controls.hint} ${styles.none}`}>No artists match “{query}”.</p>}
      </div>
    </div>
  )
}
