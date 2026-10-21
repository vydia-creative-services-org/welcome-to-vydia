'use client'
import {useLayoutEffect, useRef} from 'react'
import type {ResourceCardData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'
import styles from './ResourceViews.module.css'
import {useViewMode} from './ViewMode'

export function ResourceGrid({
  resources,
  additionalInfo,
}: {
  resources: ResourceCardData[]
  additionalInfo?: React.ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const viewMode = useViewMode()

  // Open with the card that was focused in the carousel in view. A layout effect, so the grid is
  // already scrolled there when the view transition captures it.
  useLayoutEffect(() => {
    const id = viewMode?.getFocus()
    if (!id) return
    scroller.current
      ?.querySelector<HTMLElement>(`[data-morph-id="${CSS.escape(id)}"]`)
      ?.scrollIntoView({block: 'center'})
  }, [viewMode])

  return (
    <div ref={scroller} className={styles.gridScroller}>
      <section aria-label="Resources">
        <ul className={styles.grid}>
          {resources.map((resource) => (
            <li key={resource._id} className={styles.item} data-morph-id={resource._id}>
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
