import {PageShell} from '@/components/PageShell'
import {safeNext} from '@/lib/safe-redirect'
import {LoginForm} from './LoginForm'

export const instant = false

export default async function LoginPage({searchParams}: PageProps<'/login'>) {
  const {next, error} = await searchParams
  return (
    <PageShell>
      <LoginForm next={safeNext(typeof next === 'string' ? next : null)} linkError={Boolean(error)} />
    </PageShell>
  )
}
