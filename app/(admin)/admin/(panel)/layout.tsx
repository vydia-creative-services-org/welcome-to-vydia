import {AccountMenu} from '@/components/admin/AccountMenu'
import {AdminNav} from '@/components/admin/AdminNav'
import {Toaster} from '@/components/admin/Toaster'
import {requireAdmin} from '@/lib/admin/auth'
import styles from './panel.module.css'

export const instant = false

export default async function PanelLayout({children}: {children: React.ReactNode}) {
  const {admin, isSuper} = await requireAdmin()
  const name = admin.display_name ?? admin.email

  return (
    <Toaster>
      <div className={styles.shell}>
        <header className={styles.bar}>
          <div className={styles.barInner}>
            <AdminNav />
            <AccountMenu name={name} avatarUrl={admin.avatar_url} isSuper={isSuper} />
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>
    </Toaster>
  )
}
