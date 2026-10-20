'use client'
import {useActionState, useState} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {createClient} from '@/lib/supabase/client'
import {requestPasswordReset, signIn, signUp, type AuthState} from './actions'
import styles from './LoginForm.module.css'

type Mode = 'signin' | 'signup' | 'reset'

const TITLES: Record<Mode, string> = {signin: 'Sign in', signup: 'Create your login', reset: 'Reset password'}
const SUBMIT: Record<Mode, string> = {signin: 'Sign in', signup: 'Sign up', reset: 'Send reset link'}
const ACTIONS = {signin: signIn, signup: signUp, reset: requestPasswordReset}

function ModeForm({mode, next}: {mode: Mode; next: string}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(ACTIONS[mode], {})
  return (
    <>
      <form action={formAction} className={styles.form}>
        <input type="hidden" name="next" value={next} />
        <label className={styles.field}>
          <span className="visually-hidden">Email</span>
          <input name="email" type="email" required autoComplete="email" placeholder="Email" className={ui.input} />
        </label>
        {mode !== 'reset' && (
          <label className={styles.field}>
            <span className="visually-hidden">Password</span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="Password"
              className={ui.input}
            />
          </label>
        )}
        <button disabled={pending} className={cx(ui.button, ui.primary)}>
          {SUBMIT[mode]}
        </button>
      </form>
      {state.error && (
        <p role="alert" className={cx(ui.error, styles.feedback)}>
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className={cx(ui.success, styles.feedback)}>
          {state.message}
        </p>
      )}
    </>
  )
}

export function LoginForm({next, linkError}: {next: string; linkError: boolean}) {
  const [mode, setMode] = useState<Mode>('signin')
  const [googleError, setGoogleError] = useState(false)

  async function google() {
    const {error} = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: {redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`},
    })
    setGoogleError(Boolean(error))
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{TITLES[mode]}</h1>

      {linkError && mode === 'signin' && (
        <p role="alert" className={cx(ui.error, styles.notice)}>
          That link is invalid or expired. Please try again.
        </p>
      )}

      {mode !== 'reset' && (
        <>
          <button type="button" onClick={google} className={ui.button}>
            Continue with Google
          </button>
          {googleError && (
            <p role="alert" className={cx(ui.error, styles.feedback)}>
              Google sign-in isn’t available right now. Please use your email instead.
            </p>
          )}
          <div className={styles.divider}>or</div>
        </>
      )}

      <ModeForm key={mode} mode={mode} next={next} />

      <div className={styles.footer}>
        {mode === 'signin' ? (
          <>
            <button type="button" className={ui.textButton} onClick={() => setMode('signup')}>
              First time? Sign up
            </button>
            <button type="button" className={ui.textButton} onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          </>
        ) : (
          <button type="button" className={ui.textButton} onClick={() => setMode('signin')}>
            Back to sign in
          </button>
        )}
      </div>
    </div>
  )
}
