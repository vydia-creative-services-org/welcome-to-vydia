'use client'
import {useState, useTransition} from 'react'
import {deleteClient} from '@/app/(admin)/admin/(panel)/clients/actions'
import {ConfirmDialog} from './ConfirmDialog'
import controls from './controls.module.css'

export function DeleteClientButton({id, name}: {id: string; name: string}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await deleteClient(id)
        setError(result.message)
      } catch {
        setError('Couldn’t reach the server. Nothing was changed.')
      }
      setOpen(false)
    })

  return (
    <div>
      <button type="button" className={`${controls.button} ${controls.danger}`} onClick={() => setOpen(true)}>
        Delete client
      </button>
      {error && (
        <p role="alert" className={controls.error}>
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        body="This permanently deletes the client, their emails, and their client-specific resources."
        confirmLabel="Delete client"
        tone="danger"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </div>
  )
}
