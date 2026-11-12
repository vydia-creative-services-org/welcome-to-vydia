'use client'
import {Plus} from 'lucide-react'
import {useId} from 'react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './EmailRows.module.css'

export type EmailRow = {key: string; email: string; label: string}

export const newEmailRow = (): EmailRow => ({key: crypto.randomUUID(), email: '', label: ''})

const SUGGESTED_LABELS = ['Manager', 'Alt', 'Assistant']

type Props = {
  rows: EmailRow[]
  onChange: (rows: EmailRow[]) => void
  errors: Partial<Record<string, string>>
}

export function EmailRows({rows, onChange, errors}: Props) {
  const listId = useId()
  const update = (key: string, patch: Partial<EmailRow>) =>
    onChange(rows.map((row) => (row.key === key ? {...row, ...patch} : row)))

  return (
    <fieldset className={styles.group}>
      <legend className={controls.label}>Additional emails</legend>
      {rows.map((row, index) => {
        const error = errors[`emails.${index + 1}.email`]
        return (
          <div key={row.key} className={styles.row}>
            <div className={controls.field}>
              <label htmlFor={`${listId}-email-${row.key}`} className="visually-hidden">
                Additional email {index + 1}
              </label>
              <input
                id={`${listId}-email-${row.key}`}
                type="email"
                value={row.email}
                placeholder="manager@example.com"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${listId}-error-${row.key}` : undefined}
                onChange={(event) => update(row.key, {email: event.target.value})}
                className={controls.input}
              />
              {error && (
                <p id={`${listId}-error-${row.key}`} role="alert" className={controls.error}>
                  {error}
                </p>
              )}
            </div>
            <div className={controls.field}>
              <label htmlFor={`${listId}-label-${row.key}`} className="visually-hidden">
                Label for additional email {index + 1}
              </label>
              <input
                id={`${listId}-label-${row.key}`}
                list={`${listId}-labels`}
                value={row.label}
                maxLength={40}
                placeholder="Label"
                onChange={(event) => update(row.key, {label: event.target.value})}
                className={controls.input}
              />
            </div>
            <button
              type="button"
              className={cx(controls.button, controls.danger)}
              aria-label={`Remove additional email ${index + 1}`}
              onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
            >
              Remove
            </button>
          </div>
        )
      })}
      <datalist id={`${listId}-labels`}>
        {SUGGESTED_LABELS.map((label) => (
          <option key={label} value={label} />
        ))}
      </datalist>
      <div>
        <button type="button" className={controls.button} onClick={() => onChange([...rows, newEmailRow()])}>
          <Plus aria-hidden size={14} />
          Add email
        </button>
      </div>
    </fieldset>
  )
}
