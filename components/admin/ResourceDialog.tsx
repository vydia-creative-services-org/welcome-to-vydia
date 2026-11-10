'use client'
import {useEffect, useId, useRef, useState, useTransition} from 'react'
import {upsertMainResource} from '@/app/(admin)/admin/(panel)/resources/actions'
import {draftToInput, validateDraft, type DraftErrors, type ResourceDraft} from '@/lib/admin/drafts'
import controls from './controls.module.css'
import styles from './ResourceDialog.module.css'
import {ResourceFields} from './ResourceFields'

type Props = {
  initial: ResourceDraft
  isNew: boolean
  categories: string[]
  onClose: () => void
}

export function ResourceDialog({initial, isNew, categories, onClose}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const [draft, setDraft] = useState(initial)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, startSaving] = useTransition()

  useEffect(() => {
    const element = dialog.current
    if (element && !element.open) element.showModal()
  }, [])

  const save = () => {
    const found = validateDraft(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) return
    startSaving(async () => {
      try {
        const result = await upsertMainResource(draftToInput(draft))
        if (result.ok) onClose()
        else setErrors(result.errors)
      } catch {
        setErrors({form: 'Couldn’t reach the server. Nothing was changed.'})
      }
    })
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} className={styles.dialog} onClose={onClose}>
      <form
        className={styles.content}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <h2 id={titleId} className={styles.title}>
          {isNew ? 'New resource' : 'Edit resource'}
        </h2>
        <ResourceFields draft={draft} onChange={(update) => setDraft(update)} categories={categories} errors={errors} />
        {errors.form && (
          <p role="alert" className={controls.notice}>
            {errors.form}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={controls.button} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button className={`${controls.button} ${controls.primary}`} disabled={saving || draft.uploads > 0}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
