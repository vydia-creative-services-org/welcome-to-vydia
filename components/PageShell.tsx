import { cx } from '@/lib/cx'
import { Footer } from './Footer'
import { Header } from './Header'


import styles from './PageShell.module.css'

/** `fullscreen` pins the page to the viewport; the content handles its own scrolling. */
export function PageShell({children, fullscreen}: {children: React.ReactNode; fullscreen?: boolean}) {
  return (
    <main className={cx(styles.shell, fullscreen && styles.fullscreen)}>
      <Header />
      {children}
      <Footer />
    </main>
  )
}
