'use client'
import {LoaderCircle} from 'lucide-react'
import {useEffect, useId, useRef, useState, useTransition} from 'react'
import {upsertMainResource} from '@/app/(admin)/admin/(panel)/resources/actions'
import {draftToInput, validateDraft, type DraftErrors, type ResourceDraft} from '@/lib/admin/drafts'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './dialog.module.css'
import {ResourceFields} from './ResourceFields'
import {useToast} from './Toaster'

type Props = {
  initial: ResourceDraft
  isNew: boolean
  categories: string[]
  onClose: () => void
}

export function ResourceDialog({initial, isNew, categories, onClose}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const toast = useToast()
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
        if (result.ok) {
          toast('Resource saved', 'success')
          onClose()
        } else setErrors(result.errors)
      } catch {
        setErrors({form: 'Couldn’t reach the server. Nothing was changed.'})
      }
    })
  }

  return (
    <dialog ref={dialog} aria-labelledby={titleId} className={cx(styles.dialog, styles.wide)} onClose={onClose}>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {isNew ? 'New Resource' : 'Edit Resource'}
          </h2>
        </header>
        <div className={styles.fields}>
          <ResourceFields
            draft={draft}
            onChange={(update) => setDraft(update)}
            categories={categories}
            errors={errors}
          />
          {errors.form && (
            <p role="alert" className={controls.notice}>
              {errors.form}
            </p>
          )}
        </div>
        <div className={styles.footer}>
          <button type="button" className={controls.button} onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          <button
            className={cx(controls.button, controls.primary)}
            data-loading={saving || undefined}
            disabled={saving || draft.uploads > 0}
          >
            {saving && <LoaderCircle aria-hidden size={14} className={controls.spin} />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
