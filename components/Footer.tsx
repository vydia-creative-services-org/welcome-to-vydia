import styles from './Footer.module.css'

export function Footer() {
  // Named so view transitions keep it pinned above the moving cards (see globals.css).
  return <footer className={styles.mobileFooter} style={{viewTransitionName: 'site-footer'}} aria-hidden="true" />
}
