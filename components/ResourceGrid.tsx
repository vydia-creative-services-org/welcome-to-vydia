import type {ResourceCardData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'
import styles from './ResourceViews.module.css'

export function ResourceGrid({
  resources,
  additionalInfo,
}: {
  resources: ResourceCardData[]
  additionalInfo?: React.ReactNode
}) {
  return (
    <div className={styles.gridScroller}>
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
