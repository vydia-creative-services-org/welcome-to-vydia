import Image from 'next/image'
import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <Image
        src="/vydia-logo.svg"
        alt="Vydia, a gamma company"
        width={1233}
        height={139}
        preload
        className={styles.logo}
      />
    </header>
  )
}
