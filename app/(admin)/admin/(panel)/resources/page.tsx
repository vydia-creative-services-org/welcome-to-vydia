import {SortableResourceList} from '@/components/admin/SortableResourceList'
import {requireAdmin} from '@/lib/admin/auth'
import {loadResourceContext} from '@/lib/admin/resource-context'
import {groupByCategory} from '@/lib/resources/group'

export const instant = false

export default async function MainResources() {
  const {supabase} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)

  return (
    <>
      <SortableResourceList groups={groupByCategory(mainResources)} categories={categories} />
    </>
  )
}
