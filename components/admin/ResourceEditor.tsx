'use client'
import {Plus, Trash2} from 'lucide-react'
import {useState, type Dispatch, type SetStateAction} from 'react'
import {newDraft, validateDraft, type DraftErrors, type ResourceDraft} from '@/lib/admin/drafts'
import {typeLabel} from '@/components/TypeLabel'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './ResourceEditor.module.css'
import {PreviewButton, previewHref} from './PreviewButton'
import {ResourceThumb} from './ResourceThumb'
import {ResourceFields} from './ResourceFields'

type Props = {
  drafts: ResourceDraft[]
  setDrafts: Dispatch<SetStateAction<ResourceDraft[]>>
  categories: string[]
  serverErrors: Partial<Record<string, DraftErrors>>
}

export function ResourceEditor({drafts, setDrafts, categories, serverErrors}: Props) {
  const [savedIds] = useState(() => new Set(drafts.map((draft) => draft.id)))
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
      <ul className={controls.rows}>
        {drafts.map((draft) => {
          const editing = editingId === draft.id
          const errors = {...serverErrors[draft.id], ...shownErrors[draft.id]}
          return (
            <li key={draft.id} className={editing ? undefined : controls.row}>
              {editing ? (
                <div className={styles.panel}>
                  <ResourceFields draft={draft} onChange={update(draft.id)} categories={categories} errors={errors} />
                  <div className={controls.rowActions}>
                    <button
                      type="button"
                      className={cx(controls.button, controls.primary)}
                      disabled={draft.uploads > 0}
                      onClick={() => finish(draft)}
                    >
                      Done
                    </button>
                    <button type="button" className={controls.button} onClick={() => cancel(draft)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <ResourceThumb path={draft.coverImage ?? draft.pdfPreview} />
                  <span className={controls.rowTitle}>{draft.title || 'Untitled'}</span>
                  {Object.keys(errors).length > 0 ? (
                    <span role="alert" className={controls.error}>
                      Needs attention
                    </span>
                  ) : (
                    <span className={controls.hint}>{typeLabel(draft.type)}</span>
                  )}
                  <div className={controls.rowActions}>
                    <PreviewButton
                      href={previewHref({
                        id: draft.id,
                        url: draft.url.trim() || null,
                        file: savedIds.has(draft.id) ? draft.file : null,
                      })}
                      title={draft.title || 'resource'}
                    />
                    <button
                      type="button"
                      className={cx(controls.button, controls.ghost, controls.sm)}
                      onClick={() => edit(draft)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={cx(controls.button, controls.ghost, controls.danger, controls.sm, controls.iconOnly)}
                      aria-label={`Delete ${draft.title || 'resource'}`}
                      onClick={() => setDrafts((list) => list.filter((item) => item.id !== draft.id))}
                    >
                      <Trash2 aria-hidden size={14} />
                    </button>
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ul>
      <div>
        <button type="button" className={controls.button} onClick={add} disabled={editingId !== null}>
          <Plus aria-hidden size={14} />
          Add client-specific resource
        </button>
      </div>
    </div>
  )
}
