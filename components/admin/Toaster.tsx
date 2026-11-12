'use client'
import {CircleAlert, CircleCheck} from 'lucide-react'
import {createContext, use, useCallback, useState} from 'react'
import styles from './Toaster.module.css'

type Tone = 'neutral' | 'success' | 'error'
type Toast = {id: number; message: string; tone: Tone}
type Push = (message: string, tone?: Tone) => void

const ToastContext = createContext<Push>(() => {})

export const useToast = () => use(ToastContext)

let nextId = 0

export function Toaster({children}: {children: React.ReactNode}) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback<Push>((message, tone = 'neutral') => {
    const id = ++nextId
    setToasts((list) => [...list.slice(-2), {id, message, tone}])
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 4000)
  }, [])

  return (
    <ToastContext value={push}>
      {children}
      <ol className={styles.region} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <li key={toast.id} className={styles.toast} data-tone={toast.tone}>
            {toast.tone === 'success' && <CircleCheck aria-hidden size={16} />}
            {toast.tone === 'error' && <CircleAlert aria-hidden size={16} />}
            {toast.message}
          </li>
        ))}
      </ol>
    </ToastContext>
  )
}
