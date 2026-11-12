'use client'
import {RotateCcw} from 'lucide-react'
import {useEffect} from 'react'
import controls from '@/components/admin/controls.module.css'

export default function PanelError({error, retry}: {error: unknown; retry: () => void}) {
  useEffect(() => console.error(error), [error])

  return (
    <div className={controls.card} role="alert" style={{display: 'grid', gap: 12, justifyItems: 'start'}}>
      <h1 style={{fontSize: 16, fontWeight: 600}}>This Page Didn’t Load</h1>
      <p className={controls.hint}>Nothing was changed. Check your connection and try again.</p>
      <button type="button" className={controls.button} onClick={retry}>
        <RotateCcw aria-hidden size={14} />
        Try again
      </button>
    </div>
  )
}
