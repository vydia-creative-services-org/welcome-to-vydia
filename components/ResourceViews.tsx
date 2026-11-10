'use client'
import type {CategoryGroup} from '@/lib/resources/group'
import type {ResourceCardData} from '@/lib/resources/types'
import {ResourceCarousel} from './ResourceCarousel'
import {ResourceGrid} from './ResourceGrid'
import {useViewMode} from './ViewMode'

export function ResourceViews({groups}: {groups: CategoryGroup<ResourceCardData>[]}) {
  const viewMode = useViewMode()
  const resources = groups.flatMap((group) => group.items)
  if (!resources.length) return null

  if (viewMode?.view === 'grid') return <ResourceGrid groups={groups} />

  return <ResourceCarousel resources={resources} />
}
