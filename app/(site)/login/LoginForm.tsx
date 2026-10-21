'use client'
import {useActionState, useEffect, useState} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {sendMagicLink, signInWithGoogle, type LinkState} from './actions'
import styles from './LoginForm.module.css'

// Supabase sends at most one link per email every 60 seconds.
const RESEND_AFTER_MS = 60_000

type SentState = LinkState & {sentAt?: number}

async function send(previous: SentState, form: FormData): Promise<SentState> {
  const result = await sendMagicLink(previous, form)
  return result.sentTo ? {...result, sentAt: Date.now()} : result
}

function useSecondsUntil(deadline: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

function SignInSteps({next, error, onReset}: {next: string; error: string | null; onReset: () => void}) {
  const [state, formAction, pending] = useActionState<SentState, FormData>(send, {})
  const secondsLeft = useSecondsUntil((state.sentAt ?? 0) + RESEND_AFTER_MS)

  if (state.sentTo) {
    return (
      <>
        <h1 className={styles.title}>Check your email</h1>
        <p role="status" className={styles.lede}>
          If <strong>{state.sentTo}</strong> has access, a sign-in link is on its way. It works once and expires in 1
          hour. Open it in the browser you want to stay signed in on.
        </p>
        <form action={formAction} className={styles.form}>
          <input type="hidden" name="email" value={state.sentTo} />
          <input type="hidden" name="next" value={next} />
          <button disabled={pending || secondsLeft > 0} className={ui.button}>
            {secondsLeft > 0 ? `Resend link in ${secondsLeft}s` : 'Resend link'}
          </button>
        </form>
        <div className={styles.footer}>
          <button type="button" className={ui.textButton} onClick={onReset}>
            Use a different email
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className={styles.title}>Sign in</h1>
      <p className={styles.lede}>Use the email your Vydia representative has on file for you.</p>

      {error && (
        <p role="alert" className={cx(ui.error, styles.notice)}>
          {error}
        </p>
      )}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <button className={ui.button}>Continue with Google</button>
      </form>

      <div className={styles.divider}>or</div>

      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <label className={styles.field}>
          <span className="visually-hidden">Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="Email" className={ui.input} />
        </label>
        <button disabled={pending} className={cx(ui.button, ui.primary)}>
          Email me a sign-in link
        </button>
      </form>
      {state.error && (
        <p role="alert" className={cx(ui.error, styles.feedback)}>
          {state.error}
        </p>
      )}
    </>
  )
}

export function LoginForm({next, error}: {next: string; error: string | null}) {
  // A new key throws away the "sent" state, so "Use a different email" starts over.
  const [attempt, setAttempt] = useState(0)
  return (
    <div className={styles.card}>
      <SignInSteps
        key={attempt}
        next={next}
        error={attempt === 0 ? error : null}
        onReset={() => setAttempt((n) => n + 1)}
      />
    </div>
  )
}
