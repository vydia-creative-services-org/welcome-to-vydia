
import styles from './Header.module.css'
import { GalleryHorizontal, LayoutGrid } from 'lucide-react'

export function Header() {
  return (
    <header className={styles.header}>
      <span className={styles.text}>Welcome to Vydia</span>

      <div className={styles.toggleContainer}>
        <GalleryHorizontal
          strokeWidth={2}
          color="#fff"
          height={18}
          width={18}
        />

        <LayoutGrid
          strokeWidth={2}
          color="#fff"
          height={18}
          width={18}
        />
      </div>
    </header>
  )
}
