'use client'
import {ExternalLink, MoreHorizontal, type LucideIcon} from 'lucide-react'
import {useEffect, useId, useRef, useState} from 'react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './RowActions.module.css'

export type RowAction = {
  key: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  href?: string | null
}

export const previewAction = (href: string | null): RowAction | null =>
  href ? {key: 'preview', label: 'Preview', icon: ExternalLink, href} : null

type Props = {name: string; actions: (RowAction | null)[]}

export function RowActions({name, actions}: Props) {
  const items = actions.filter((action): action is RowAction => action !== null)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  return (
    <div ref={root} className={styles.root}>
      <div className={styles.inline}>
        {items.map((action) => {
          const Icon = action.icon
          const content = (
            <>
              <Icon aria-hidden size={14} />
              {action.label}
            </>
          )
          const className = cx(controls.button, controls.sm)
          const label = `${action.label} ${name}`
          return action.href ? (
            <a
              key={action.key}
              href={action.href}
              target="_blank"
              rel="noopener"
              aria-label={label}
              className={className}
            >
              {content}
            </a>
          ) : (
            <button key={action.key} type="button" aria-label={label} className={className} onClick={action.onClick}>
              {content}
            </button>
          )
        })}
      </div>
      <div className={styles.compact}>
        <button
          ref={trigger}
          type="button"
          className={cx(controls.button, controls.sm, controls.iconOnly)}
          aria-label={`Actions for ${name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((value) => !value)}
        >
          <MoreHorizontal aria-hidden size={14} />
        </button>
        {open && (
          <div id={menuId} role="menu" className={styles.panel}>
            {items.map((action) => {
              const Icon = action.icon
              const content = (
                <>
                  <Icon aria-hidden size={14} />
                  {action.label}
                </>
              )
              const className = cx(controls.button, controls.ghost, styles.item)
              return action.href ? (
                <a
                  key={action.key}
                  role="menuitem"
                  href={action.href}
                  target="_blank"
                  rel="noopener"
                  className={className}
                  onClick={() => setOpen(false)}
                >
                  {content}
                </a>
              ) : (
                <button
                  key={action.key}
                  type="button"
                  role="menuitem"
                  className={className}
                  onClick={() => {
                    setOpen(false)
                    action.onClick?.()
                  }}
                >
                  {content}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
