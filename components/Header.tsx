'use client'
import {GalleryHorizontal, GalleryVertical, LayoutGrid} from 'lucide-react'
import styles from './Header.module.css'
import {useViewMode} from './ViewMode'

export function Header() {
  const viewMode = useViewMode()

  return (
    // Named so view transitions keep it pinned above the moving cards (see globals.css).
    <header className={styles.header} style={{viewTransitionName: 'site-header'}}>
      <span className={styles.text}>Welcome to Vydia</span>

      {viewMode && (
        <div className={styles.toggleContainer} role="group" aria-label="View">
          <button
            type="button"
            className={styles.toggle}
            aria-label="Carousel view"
            aria-pressed={viewMode.view === 'carousel'}
            onClick={() => viewMode.setView('carousel')}
          >
            <GalleryHorizontal aria-hidden strokeWidth={2} height={18} width={18} className={styles.desktopIcon} />
            <GalleryVertical aria-hidden strokeWidth={2} height={18} width={18} className={styles.mobileIcon} />
          </button>
          <button
            type="button"
            className={styles.toggle}
            aria-label="Grid view"
            aria-pressed={viewMode.view === 'grid'}
            onClick={() => viewMode.setView('grid')}
          >
            <LayoutGrid aria-hidden strokeWidth={2} height={18} width={18} />
          </button>
        </div>
      )}
    </header>
  )
}
