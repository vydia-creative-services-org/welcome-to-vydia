import {Notice} from '@/components/Notice'
import {PageShell} from '@/components/PageShell'

export default function Home() {
  return (
    <PageShell>
      <Notice title="Looking for your Vydia resources?">
        Open the personal link your Vydia representative sent you. It looks like{' '}
        <strong>welcometovydia.com/your-artist-name</strong>. You’ll be asked to sign in with the email address Vydia
        has on file for you. Can’t find your link? Reach out to your Vydia representative.
      </Notice>
    </PageShell>
  )
}
