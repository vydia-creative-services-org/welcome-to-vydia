'use client'
import {useEffect, useRef, useState} from 'react'
import {welcomeLink} from '@/lib/admin/welcome-link'
import controls from './controls.module.css'
import styles from './CopyLinkButton.module.css'

export function CopyLinkButton({slug, size = 'small'}: {slug: string; size?: 'small' | 'regular'}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const field = useRef<HTMLInputElement>(null)
  const link = welcomeLink(slug)

  useEffect(() => {
    if (state === 'manual') field.current?.select()
    if (state !== 'copied') return
    const id = setTimeout(() => setState('idle'), 1500)
    return () => clearTimeout(id)
  }, [state])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setState('copied')
    } catch {
      setState('manual')
    }
  }

  if (state === 'manual') {
    return (
      <span className={styles.manual}>
        <input
          ref={field}
          readOnly
          value={link}
          aria-label="Welcome link"
          className={`${controls.input} ${styles.field}`}
          onBlur={() => setState('idle')}
        />
        <span className={controls.hint}>Copy it with Ctrl+C.</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={`${controls.button} ${size === 'small' ? controls.small : ''}`}
      onClick={copy}
      aria-live="polite"
    >
      {state === 'copied' ? 'Copied' : 'Copy link'}
    </button>
  )
}
