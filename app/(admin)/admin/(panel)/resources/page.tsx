import {ReadOnlyResourceList} from '@/components/admin/ReadOnlyResourceList'
import {SortableResourceList} from '@/components/admin/SortableResourceList'
import {requireAdmin} from '@/lib/admin/auth'
import {loadResourceContext} from '@/lib/admin/resource-context'
import {groupByCategory} from '@/lib/resources/group'

export const instant = false

export default async function MainResources() {
  const {supabase, isSuper} = await requireAdmin()
  const {mainResources, categories} = await loadResourceContext(supabase)
  const groups = groupByCategory(mainResources)

  return isSuper ? (
    <SortableResourceList groups={groups} categories={categories} />
  ) : (
    <ReadOnlyResourceList groups={groups} />
  )
}
