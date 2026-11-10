'use client'
import {useState, useTransition} from 'react'
import {deleteArtist} from '@/app/(admin)/admin/(panel)/artists/actions'
import {ConfirmDialog} from './ConfirmDialog'
import controls from './controls.module.css'

export function DeleteArtistButton({id, name}: {id: string; name: string}) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      try {
        const result = await deleteArtist(id)
        setError(result.message)
      } catch {
        setError('Couldn’t reach the server. Nothing was changed.')
      }
      setOpen(false)
    })

  return (
    <div>
      <button type="button" className={`${controls.button} ${controls.danger}`} onClick={() => setOpen(true)}>
        Delete artist
      </button>
      {error && (
        <p role="alert" className={controls.error}>
          {error}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        body="Their page, emails, hidden resources, and exclusive resources are permanently deleted. Anyone attached only to this artist loses access. The link can be reused."
        confirmLabel="Delete artist"
        tone="danger"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </div>
  )
}
