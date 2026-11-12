'use client'
import {Check, Copy} from 'lucide-react'
import {useEffect, useRef, useState} from 'react'
import {welcomeLink} from '@/lib/admin/welcome-link'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import styles from './CopyLinkButton.module.css'

export function CopyLinkButton({slug}: {slug: string}) {
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
      <input
        ref={field}
        readOnly
        value={link}
        aria-label="Welcome link"
        className={cx(controls.input, styles.field)}
        onBlur={() => setState('idle')}
      />
    )
  }

  return (
    <button type="button" className={cx(controls.button, controls.sm)} onClick={copy} aria-live="polite">
      {state === 'copied' ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}
      {state === 'copied' ? 'Copied' : 'Copy link'}
    </button>
  )
}
