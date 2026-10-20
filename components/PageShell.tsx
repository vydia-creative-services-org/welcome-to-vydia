import { Footer } from './Footer'
import { Header } from './Header'


import styles from './PageShell.module.css'

export function PageShell({children}: {children: React.ReactNode}) {
  return (
    <main className={styles.shell}>
      <Header />
      {children}
      <Footer />
    </main>
  )
}
