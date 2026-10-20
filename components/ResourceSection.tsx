import type {SectionData} from '@/lib/sanity/types'
import {ResourceCard} from './ResourceCard'
import styles from './ResourceSection.module.css'

export function ResourceSection({section}: {section: SectionData}) {
  if (!section.resources.length) return null
  const headingId = `section-${section._id}`
  return (
    <section aria-labelledby={headingId} className={styles.section}>
      <div>
        <h2 id={headingId} className={styles.title}>
          {section.title}
        </h2>
        {section.subtitle && <p className={styles.subtitle}>{section.subtitle}</p>}
      </div>
      <ul className={styles.grid}>
        {section.resources.map((resource) => (
          <li key={resource._id} className={styles.item}>
            <ResourceCard resource={resource} />
          </li>
        ))}
      </ul>
    </section>
  )
}
