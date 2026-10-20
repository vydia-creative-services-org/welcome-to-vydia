'use client'
import {useRouter} from 'next/navigation'
import {useState, type FormEvent} from 'react'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {createClient} from '@/lib/supabase/client'
import styles from '../../login/LoginForm.module.css'

export function UpdatePasswordForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = form.get('password')
    const confirm = form.get('confirm')
    if (typeof password !== 'string' || password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setPending(true)
    const {error: updateError} = await createClient().auth.updateUser({password})
    setPending(false)
    if (updateError) {
      setError(
        updateError.code === 'weak_password'
          ? 'Use a password with at least 8 characters.'
          : 'We couldn’t update your password. Request a new reset link and try again.',
      )
      return
    }
    router.replace('/')
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>Choose a new password</h1>
      <form onSubmit={submit} className={styles.form}>
        <label className={styles.field}>
          <span className="visually-hidden">New password</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="New password"
            className={ui.input}
          />
        </label>
        <label className={styles.field}>
          <span className="visually-hidden">Confirm new password</span>
          <input
            name="confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className={ui.input}
          />
        </label>
        <button disabled={pending} className={cx(ui.button, ui.primary)}>
          Save password
        </button>
      </form>
      {error && (
        <p role="alert" className={cx(ui.error, styles.feedback)}>
          {error}
        </p>
      )}
    </div>
  )
}
