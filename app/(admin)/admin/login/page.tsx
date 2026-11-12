import {CircleAlert} from 'lucide-react'
import {redirect} from 'next/navigation'
import controls from '@/components/admin/controls.module.css'
import {GoogleMark} from '@/components/admin/GoogleMark'
import {getAdmin} from '@/lib/admin/auth'
import {signInWithGoogle} from './actions'
import styles from './login.module.css'

export const instant = false

const ERRORS: Record<string, string> = {
  'no-access': 'You don’t have access.',
  google: 'Google sign-in isn’t available right now. Try again in a minute.',
}

export default async function AdminLogin({searchParams}: PageProps<'/admin/login'>) {
  const {error} = await searchParams
  if (await getAdmin()) redirect('/admin')
  const message = typeof error === 'string' ? ERRORS[error] : undefined

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <span aria-hidden className={styles.mark} />
        <h1 className={styles.title}>Sign In to Onboarding</h1>
        {message && (
          <p role="alert" className={controls.notice}>
            <CircleAlert aria-hidden size={16} />
            {message}
          </p>
        )}
        <form action={signInWithGoogle}>
          <button className={styles.google}>
            <GoogleMark />
            Sign in with Google
          </button>
        </form>
      </div>
    </main>
  )
}
