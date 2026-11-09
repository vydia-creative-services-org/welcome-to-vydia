import {Notice} from '@/components/Notice'
import {PageShell} from '@/components/PageShell'

export default function Home() {
  return (
    <PageShell>
      <Notice title="Looking for your Vydia resources?">
        Open the personal link Vydia label services sent you. It looks like{' '}
        <strong>welcometovydia.com/your-artist-name</strong>. Then enter the email address Vydia has on file for you and
        we’ll send you a link to your page. Can’t find your link? Reach out to Vydia label services.
      </Notice>
    </PageShell>
  )
}
