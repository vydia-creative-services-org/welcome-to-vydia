'use client'
import {LoaderCircle} from 'lucide-react'
import {useEffect, useId, useRef} from 'react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './dialog.module.css'

type Props = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  tone?: 'default' | 'danger'
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  tone = 'default',
  pending,
  onConfirm,
  onCancel,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    if (open && !element.open) element.showModal()
    if (!open && element.open) element.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={styles.dialog}
      onClose={onCancel}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <header className={styles.header}>
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
      </header>
      <p className={styles.body}>{body}</p>
      <div className={styles.footer}>
        <button type="button" className={controls.button} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          disabled={pending}
          data-loading={pending || undefined}
          className={cx(controls.button, tone === 'danger' ? controls.destructive : controls.primary)}
          onClick={onConfirm}
        >
          {pending && <LoaderCircle aria-hidden size={14} className={controls.spin} />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
