'use client'
import {useState, type Dispatch, type SetStateAction} from 'react'
import {newDraft, validateDraft, type DraftErrors, type ResourceDraft} from '@/lib/admin/drafts'
import {typeLabel} from '@/components/TypeLabel'
import controls from './controls.module.css'
import styles from './ResourceEditor.module.css'
import {ResourceFields} from './ResourceFields'

type Props = {
  drafts: ResourceDraft[]
  setDrafts: Dispatch<SetStateAction<ResourceDraft[]>>
  categories: string[]
  serverErrors: Partial<Record<string, DraftErrors>>
}

export function ResourceEditor({drafts, setDrafts, categories, serverErrors}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<ResourceDraft | null>(null)
  const [shownErrors, setShownErrors] = useState<Partial<Record<string, DraftErrors>>>({})

  const update = (id: string) => (change: (draft: ResourceDraft) => ResourceDraft) =>
    setDrafts((list) => list.map((draft) => (draft.id === id ? change(draft) : draft)))

  const add = () => {
    const draft = newDraft()
    setDrafts((list) => [...list, draft])
    setSnapshot(null)
    setEditingId(draft.id)
  }

  const edit = (draft: ResourceDraft) => {
    setSnapshot(draft)
    setEditingId(draft.id)
  }

  const finish = (draft: ResourceDraft) => {
    const errors = validateDraft(draft)
    setShownErrors((current) => ({...current, [draft.id]: errors}))
    if (Object.keys(errors).length === 0) setEditingId(null)
  }

  const cancel = (draft: ResourceDraft) => {
    setDrafts((list) =>
      snapshot
        ? list.map((item) => (item.id === draft.id ? snapshot : item))
        : list.filter((item) => item.id !== draft.id),
    )
    setShownErrors((current) => ({...current, [draft.id]: {}}))
    setEditingId(null)
  }

  return (
    <div className={styles.editor}>
      {drafts.length === 0 && (
        <p className={controls.hint}>No exclusive resources. Only the main resources above are shown.</p>
      )}
      <ul className={styles.list}>
        {drafts.map((draft) => {
          const editing = editingId === draft.id
          const errors = {...serverErrors[draft.id], ...shownErrors[draft.id]}
          return (
            <li key={draft.id} className={styles.item}>
              {editing ? (
                <div className={styles.panel}>
                  <ResourceFields draft={draft} onChange={update(draft.id)} categories={categories} errors={errors} />
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${controls.button} ${controls.primary} ${controls.small}`}
                      disabled={draft.uploads > 0}
                      onClick={() => finish(draft)}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      className={`${controls.button} ${controls.small}`}
                      onClick={() => cancel(draft)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className={styles.summary}>
                  <div className={styles.text}>
                    <span className={styles.title}>{draft.title || 'Untitled resource'}</span>
                    <span className={controls.hint}>
                      {typeLabel(draft.type)} · {draft.category || 'No category'}
                    </span>
                    {Object.keys(errors).length > 0 && (
                      <span role="alert" className={controls.error}>
                        Fix the highlighted fields: edit this resource.
                      </span>
                    )}
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${controls.button} ${controls.small}`}
                      onClick={() => edit(draft)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`${controls.button} ${controls.danger} ${controls.small}`}
                      aria-label={`Delete ${draft.title || 'resource'}`}
                      onClick={() => setDrafts((list) => list.filter((item) => item.id !== draft.id))}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div>
        <button
          type="button"
          className={`${controls.button} ${controls.small}`}
          onClick={add}
          disabled={editingId !== null}
        >
          Add exclusive resource
        </button>
      </div>
    </div>
  )
}
