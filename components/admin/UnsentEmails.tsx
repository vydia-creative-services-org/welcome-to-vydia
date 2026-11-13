'use client'
import {CircleAlert, LoaderCircle, RotateCcw} from 'lucide-react'
import {useState, useTransition} from 'react'
import {retryWelcomeEmails} from '@/app/(admin)/admin/(panel)/clients/actions'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'
import {useToast} from './Toaster'

// Emails on this client whose welcome email didn't go out. They stay listed until a send succeeds.
export function UnsentEmails({clientId, emails}: {clientId: string; emails: string[]}) {
  const toast = useToast()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const retry = () =>
    startTransition(async () => {
      setError(null)
      try {
        const result = await retryWelcomeEmails(clientId)
        if (result.ok) toast('Welcome email sent', 'success')
        else setError('Still couldn’t send. Try again in a few minutes.')
      } catch {
        setError('Couldn’t reach the server. Try again.')
      }
    })

  return (
    <div role="alert" className={controls.notice} data-tone="warning" style={{alignItems: 'center'}}>
      <CircleAlert aria-hidden size={16} />
      <span style={{flex: 1}}>
        Welcome email not sent to {emails.join(', ')}.{error && ` ${error}`}
      </span>
      <button
        type="button"
        className={cx(controls.button, controls.sm)}
        disabled={pending}
        data-loading={pending || undefined}
        onClick={retry}
      >
        {pending ? (
          <LoaderCircle aria-hidden size={14} className={controls.spin} />
        ) : (
          <RotateCcw aria-hidden size={14} />
        )}
        Retry
      </button>
    </div>
  )
}
