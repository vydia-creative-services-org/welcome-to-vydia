import Image from 'next/image'
import {AdminNav} from '@/components/admin/AdminNav'
import {requireAdmin} from '@/lib/admin/auth'
import controls from '@/components/admin/controls.module.css'
import styles from './panel.module.css'

export const instant = false

export default async function PanelLayout({children}: {children: React.ReactNode}) {
  const {admin, isSuper} = await requireAdmin()
  const name = admin.display_name ?? admin.email

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <div className={styles.barInner}>
          <AdminNav />
          <div className={styles.me}>
            {admin.avatar_url && (
              <Image
                src={admin.avatar_url}
                alt=""
                width={28}
                height={28}
                unoptimized
                referrerPolicy="no-referrer"
                className={styles.avatar}
              />
            )}
            <span className={styles.name}>{name}</span>
            {isSuper && <span className={styles.roleBadge}>Super admin</span>}
            <form action="/admin/auth/signout" method="post">
              <button className={controls.button}>Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
