import {cx} from '@/lib/cx'
import {Footer} from './Footer'
import {Header} from './Header'

import styles from './PageShell.module.css'

/**
 * `fullscreen` pins the page to the viewport; the content handles its own scrolling.
 * `clientName` is shown in the header greeting.
 */
export function PageShell({
  children,
  fullscreen,
  clientName,
}: {
  children: React.ReactNode
  fullscreen?: boolean
  clientName?: string
}) {
  return (
    <main className={cx(styles.shell, fullscreen && styles.fullscreen)}>
      <Header clientName={clientName} />
      {children}
      <Footer />
    </main>
  )
}
