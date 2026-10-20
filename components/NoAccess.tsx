import {Notice} from './Notice'
import {PageShell} from './PageShell'
import ui from './ui/controls.module.css'

export function NoAccess() {
  return (
    <PageShell>
      <Notice
        title="This page isn’t available"
        action={
          <form action="/auth/signout" method="post">
            <button className={ui.button}>Sign in with a different email</button>
          </form>
        }
      >
        This page doesn’t exist or your email doesn’t have access to it. If you think this is a mistake, contact your
        Vydia representative, or sign in with a different email.
      </Notice>
    </PageShell>
  )
}
