'use client'
import {useActionState, useEffect, useState} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {EMAIL_PATTERN, normalizeEmail} from '@/lib/email'
import {sendLink, type LinkState} from './actions'
import styles from './EnterEmail.module.css'

const RESEND_AFTER_MS = 60_000

type ClientState = LinkState & {sentAt?: number}

async function submit(previous: ClientState, form: FormData): Promise<ClientState> {
  const next = await sendLink(previous, form)
  return next.status === 'sent' ? {...next, sentAt: Date.now()} : next
}

function useSecondsLeft(sentAt: number | undefined) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (!sentAt) return
    const tick = () => setNow(Date.now())
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sentAt])
  if (!sentAt) return 0
  // Before the first tick, `now` is 0; treat as just sent so the full countdown shows.
  if (!now) return RESEND_AFTER_MS / 1000
  return Math.min(RESEND_AFTER_MS / 1000, Math.max(0, Math.ceil((sentAt + RESEND_AFTER_MS - now) / 1000)))
}

const MESSAGES: Partial<Record<LinkState['status'], string>> = {
  'not-approved':
    'This email isn’t approved to view this page. Make sure you’re using the URL provided by Vydia label services, or contact them if you’re having trouble.',
  invalid: 'Enter your full email address.',
  'rate-limited': 'Too many attempts. Please wait a few minutes and try again.',
  error: 'Something went wrong sending your link. Please try again.',
}

export function EnterEmail({slug}: {slug: string}) {
  const [state, action, pending] = useActionState<ClientState, FormData>(submit, {status: 'idle'})
  const [email, setEmail] = useState('')
  const ready = EMAIL_PATTERN.test(normalizeEmail(email))
  const secondsLeft = useSecondsLeft(state.status === 'sent' ? state.sentAt : undefined)

  if (state.status === 'sent') {
    return (
      <div className={styles.panel}>
        <h1 className="visually-hidden">Check your inbox</h1>
        <p role="status" className={styles.sent}>
          Email sent, check your inbox
        </p>
        <form action={action} className={styles.form}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="email" value={state.email} />
          <button
            disabled={pending || secondsLeft > 0}
            data-pending={pending || undefined}
            className={cx(ui.button, styles.resend)}
          >
            {pending && <span aria-hidden className={styles.spinner} />}
            {secondsLeft > 0 ? `Resend email (${secondsLeft}s)` : 'Resend email'}
          </button>
        </form>
      </div>
    )
  }

  const message = MESSAGES[state.status]
  return (
    <div className={styles.panel}>
      <h1 className="visually-hidden">Enter your email</h1>
      <div className={styles.fields}>
        <form action={action} className={styles.form}>
          <input type="hidden" name="slug" value={slug} />
          <label>
            <span className="visually-hidden">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-describedby={message ? 'enter-email-message' : undefined}
              className={cx(ui.input, styles.input)}
            />
          </label>
          <button disabled={pending} data-ready={ready || undefined} className={cx(ui.button, ui.primary, styles.send)}>
            {pending && <span aria-hidden className={styles.spinner} />}
            Continue
          </button>
        </form>
        {message && (
          <p id="enter-email-message" role="alert" className={cx(ui.error, styles.message)}>
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
