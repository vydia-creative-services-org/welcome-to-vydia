'use client'
import type {ResourceCardData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'
import {ResourceCarousel} from './ResourceCarousel'
import styles from './ResourceViews.module.css'
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

  if (viewMode?.view === 'grid') {
    return (
      <div className={styles.gridScroller}>
        <section aria-label="Resources">
          <ul className={styles.grid}>
            {resources.map((resource) => (
              <li key={resource._id} className={styles.item}>
                <ResourceCard resource={resource} />
              </li>
            ))}
          </ul>
        </section>
        {additionalInfo && (
          <section aria-label="Additional information" className={styles.additionalInfo}>
            {additionalInfo}
          </section>
        )}
      </div>
    )
  }

  return <ResourceCarousel resources={resources} />
}
