import {redirect} from 'next/navigation'
import {PageShell} from '@/components/PageShell'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {safeNext} from '@/lib/safe-redirect'
import styles from '../../login/LoginForm.module.css'
import {confirmSignIn} from './actions'

export const instant = false

// Signing in needs a click: email scanners open every link in a message and would use up the token on a GET.
export default async function ConfirmPage({searchParams}: PageProps<'/auth/confirm'>) {
  const {token_hash: tokenHash, redirect_to: redirectTo} = await searchParams
  if (typeof tokenHash !== 'string' || !tokenHash) redirect('/login?error=link')

  return (
    <PageShell>
      <div className={styles.card}>
        <h1 className={styles.title}>Finish signing in</h1>
        <p className={styles.lede}>Continue to open your Vydia resources in this browser.</p>
        <form action={confirmSignIn} className={styles.form}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="next" value={safeNext(typeof redirectTo === 'string' ? redirectTo : null)} />
          <button className={cx(ui.button, ui.primary)}>Continue</button>
        </form>
      </div>
    </PageShell>
  )
}
