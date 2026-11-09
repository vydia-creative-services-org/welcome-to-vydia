import {redirect} from 'next/navigation'
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
        <h1 className={styles.title}>Welcome to Vydia admin</h1>
        <p className={styles.lede}>Sign in with your Vydia Google account.</p>
        {message && (
          <p role="alert" className={styles.error}>
            {message}
          </p>
        )}
        <form action={signInWithGoogle}>
          <button className={styles.google}>Sign in with Google</button>
        </form>
      </div>
    </main>
  )
}
