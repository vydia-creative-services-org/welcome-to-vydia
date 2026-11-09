'use client'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import styles from './AdminNav.module.css'

const LINKS = [
  {href: '/admin', label: 'Artists', match: (path: string) => path === '/admin' || path.startsWith('/admin/artists')},
  {href: '/admin/resources', label: 'Resources', match: (path: string) => path.startsWith('/admin/resources')},
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className={styles.nav}>
      <Link href="/admin" className={styles.brand}>
        Welcome to Vydia
      </Link>
      <ul className={styles.links}>
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={styles.link} aria-current={link.match(pathname) ? 'page' : undefined}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
