'use client'
import type {ResourceCardData} from '@/lib/sanity/types'
import {ResourceCarousel} from './ResourceCarousel'
import {ResourceGrid} from './ResourceGrid'
import {useViewMode} from './ViewMode'

export function ResourceViews({
  resources,
  additionalInfo,
}: {
  resources: ResourceCardData[]
  /** Shown below the grid; the carousel fills the screen, so there's no room for it there. */
  additionalInfo?: React.ReactNode
}) {
  const viewMode = useViewMode()
  if (!resources.length) return null

  if (viewMode?.view === 'grid') return <ResourceGrid resources={resources} additionalInfo={additionalInfo} />

  return <ResourceCarousel resources={resources} />
}
