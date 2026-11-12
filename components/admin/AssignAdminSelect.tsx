'use client'
import {useId, useState, useTransition} from 'react'
import {assignClient} from '@/app/(admin)/admin/(panel)/clients/actions'
import controls from './controls.module.css'
import styles from './AssignAdminSelect.module.css'
import {useToast} from './Toaster'

type Props = {
  clientId: string
  current: string | null
  admins: {email: string; display_name: string | null}[]
}

export function AssignAdminSelect({clientId, current, admins}: Props) {
  const id = useId()
  const toast = useToast()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(current ?? '')
  const [message, setMessage] = useState<string | null>(null)

  const onChange = (next: string) => {
    const previous = value
    setValue(next)
    setMessage(null)
    startTransition(async () => {
      const result = await assignClient({clientId, adminEmail: next || null})
      if (result.ok) {
        const owner = admins.find((admin) => admin.email === next)
        toast(next ? `Reassigned to ${owner?.display_name ?? next}` : 'Client unassigned', 'success')
      } else {
        setValue(previous)
        setMessage(result.message ?? 'Couldn’t reassign the client.')
      }
    })
  }

  return (
    <div className={styles.wrap}>
      <label htmlFor={id} className={controls.label}>
        Assigned to
      </label>
      <select
        id={id}
        className={controls.input}
        value={value}
        disabled={pending}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Unassigned (super admins only)</option>
        {admins.map((admin) => (
          <option key={admin.email} value={admin.email}>
            {admin.display_name ?? admin.email}
          </option>
        ))}
      </select>
      {message && (
        <p role="alert" className={controls.error}>
          {message}
        </p>
      )}
    </div>
  )
}
