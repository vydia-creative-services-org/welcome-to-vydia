'use client'
import {GalleryHorizontal, GalleryVertical, LayoutGrid} from 'lucide-react'
import {useEffect, useRef} from 'react'
import styles from './Header.module.css'
import {useViewMode} from './ViewMode'

/** `artistName` greets the artist by name; pages without one show the plain welcome. */
export function Header({artistName}: {artistName?: string}) {
  const viewMode = useViewMode()
  const isGrid = viewMode?.view === 'grid'
  const toggle = useRef<HTMLButtonElement>(null)

  // While a switch animates, the browser hit-tests the whole page as <html>, so the button can't be
  // clicked directly. A click on its spot still toggles (the provider queues it until the switch ends).
  const toggleView = viewMode?.toggleView
  useEffect(() => {
    if (!toggleView) return
    const onClick = (event: MouseEvent) => {
      if (event.target !== document.documentElement || !('viewSwitching' in document.documentElement.dataset)) return
      const box = toggle.current?.getBoundingClientRect()
      if (
        box &&
        event.clientX >= box.left &&
        event.clientX <= box.right &&
        event.clientY >= box.top &&
        event.clientY <= box.bottom
      ) {
        toggleView()
      }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [toggleView])

  return (
    // Named so view transitions keep it pinned above the moving cards (see globals.css).
    <header className={styles.header} style={{viewTransitionName: 'site-header'}}>
      <span className={styles.text}>
        {artistName
          ? `${artistName} \u00A0 | \u00A0 Welcome to Vydia`
          : 'Welcome to Vydia'}
      </span>

      {viewMode && (
        // One button that swaps between the views; its label says what pressing it will do. The
        // current view's icon is white, the other dimmed.
        <button
          ref={toggle}
          type="button"
          className={styles.toggle}
          aria-label={isGrid ? 'Switch to carousel view' : 'Switch to grid view'}
          onClick={viewMode.toggleView}
        >
          <span className={styles.toggleIcon} data-current={!isGrid || undefined}>
            <GalleryHorizontal aria-hidden strokeWidth={2} height={18} width={18} className={styles.desktopIcon} />
            <GalleryVertical aria-hidden strokeWidth={2} height={18} width={18} className={styles.mobileIcon} />
          </span>
          <span className={styles.toggleIcon} data-current={isGrid || undefined}>
            <LayoutGrid aria-hidden strokeWidth={2} height={18} width={18} />
          </span>
        </button>
      )}
    </header>
  )
}
