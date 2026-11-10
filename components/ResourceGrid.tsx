'use client'
import {useLayoutEffect, useRef} from 'react'
import type {CategoryGroup} from '@/lib/resources/group'
import type {ResourceCardData} from '@/lib/resources/types'
import {ResourceCard} from './ResourceCard'
import categories from './ResourceCategories.module.css'
import styles from './ResourceViews.module.css'
import {useViewMode} from './ViewMode'

export function ResourceGrid({groups}: {groups: CategoryGroup<ResourceCardData>[]}) {
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
        {groups.map((group, index) => (
          <section key={group.key} aria-labelledby={`category-${index}`} className={categories.category}>
            <h2 id={`category-${index}`} className={categories.categoryTitle}>
              {group.category}
            </h2>
            <ul className={styles.grid}>
              {group.items.map((resource) => (
                <li key={resource.id} className={styles.item} data-morph-id={resource.id}>
                  <ResourceCard resource={resource} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </section>
    </div>
  )
}
