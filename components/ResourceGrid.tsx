'use client'
import {useRef} from 'react'
import type {ResourceCardData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'
import styles from './ResourceViews.module.css'
import {useScrollInertia} from './useScrollInertia'

export function ResourceGrid({
  resources,
  additionalInfo,
}: {
  resources: ResourceCardData[]
  additionalInfo?: React.ReactNode
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)

  // Scrolling stays native; the content is offset by how far the eased position trails the real
  // one, so it glides to a stop. The transform is cleared at rest.
  useScrollInertia(scroller, (y) => {
    const lag = (scroller.current?.scrollTop ?? y) - y
    if (content.current) content.current.style.transform = lag ? `translate3d(0, ${lag}px, 0)` : ''
  })

  return (
    <div ref={scroller} className={styles.gridScroller}>
      <div ref={content}>
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
    </div>
  )
}
