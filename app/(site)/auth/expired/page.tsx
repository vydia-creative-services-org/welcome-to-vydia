import Link from 'next/link'
import {Notice} from '@/components/Notice'
import {PageShell} from '@/components/PageShell'
import ui from '@/components/ui/controls.module.css'
import {cx} from '@/lib/cx'
import {safeNext} from '@/lib/safe-redirect'

export const instant = false

export default async function ExpiredPage({searchParams}: PageProps<'/auth/expired'>) {
  const {next} = await searchParams
  const back = safeNext(typeof next === 'string' ? next : null)
  return (
    <PageShell>
      <Notice
        title="This Link Has Expired"
        action={
          <Link href={back} className={cx(ui.button, ui.primary)}>
            Send a new link
          </Link>
        }
      >
        Sign-in links work once and expire after an hour.
      </Notice>
    </PageShell>
  )
}
