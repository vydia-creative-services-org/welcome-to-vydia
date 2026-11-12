'use client'
import {LogOut} from 'lucide-react'
import Image from 'next/image'
import {useEffect, useId, useRef, useState} from 'react'
import {cx} from '@/lib/cx'
import styles from './AccountMenu.module.css'
import controls from './controls.module.css'
import {ThemeToggle} from './ThemeToggle'

type Props = {name: string; avatarUrl: string | null; isSuper: boolean}

export function AccountMenu({name, avatarUrl, isSuper}: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panelId = useId()

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

  return (
    <div ref={root} className={styles.root}>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-label="Account"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            unoptimized
            referrerPolicy="no-referrer"
            className={styles.avatar}
          />
        ) : (
          <span aria-hidden className={cx(styles.avatar, styles.initial)}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} className={styles.panel}>
          <p className={styles.identity}>
            <span className={styles.name}>{name}</span>
            {isSuper && <span className={controls.badge}>Super admin</span>}
          </p>
          <ThemeToggle />
          <form action="/admin/auth/signout" method="post">
            <button className={cx(controls.button, controls.ghost, styles.item)}>
              <LogOut aria-hidden size={14} />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
