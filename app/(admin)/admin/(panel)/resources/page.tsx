import {SortableResourceList} from '@/components/admin/SortableResourceList'
import {requireAdmin} from '@/lib/admin/auth'
import {loadResourceContext} from '@/lib/admin/resource-context'
import {groupByCategory} from '@/lib/resources/group'
import styles from '../panel.module.css'

export const instant = false

export default async function MainResources() {
  const {supabase} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)

  return (
    <>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Main resources</h1>
      </header>
      <SortableResourceList groups={groupByCategory(mainResources)} categories={categories} />
    </>
  )
}
