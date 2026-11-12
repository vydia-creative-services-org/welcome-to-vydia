import {ClientForm} from '@/components/admin/ClientForm'
import {requireAdmin} from '@/lib/admin/auth'
import {emptyClientForm} from '@/lib/admin/form-initial'
import {loadResourceContext} from '@/lib/admin/resource-context'
import styles from '../../panel.module.css'

export const instant = false

export default async function NewClient() {
  const {supabase} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>New Client</h1>
      </header>
      <ClientForm initial={emptyClientForm} mainResources={mainResources} categories={categories} />
    </>
  )
}
