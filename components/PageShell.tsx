import { cx } from '@/lib/cx'
import { Footer } from './Footer'
import { Header } from './Header'


import styles from './PageShell.module.css'

/**
 * `fullscreen` pins the page to the viewport; the content handles its own scrolling.
 * `artistName` is shown in the header greeting.
 */
export function PageShell({
  children,
  fullscreen,
  artistName,
}: {
  children: React.ReactNode
  fullscreen?: boolean
  artistName?: string
}) {
  return (
    <main className={cx(styles.shell, fullscreen && styles.fullscreen)}>
      <Header artistName={artistName} />
      {children}
      <Footer />
    </main>
  )
}
