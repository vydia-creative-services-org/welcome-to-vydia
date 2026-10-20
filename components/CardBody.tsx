import {formatAddedOn} from '@/lib/format'
import type {ResourceCardData} from '@/lib/sanity/types'
import {CardCover} from './CardCover'
import {FileTypeBadge} from './FileTypeBadge'
import styles from './ResourceCard.module.css'

export function CardBody({resource}: {resource: ResourceCardData}) {
  return (
    <>
      <div className={styles.cover}>
        <CardCover resource={resource} />
      </div>
      <div className={styles.body}>
        <FileTypeBadge type={resource.type} className={styles.badge} />
        <h3 className={styles.title}>{resource.title}</h3>
        <p className={styles.date}>{formatAddedOn(resource.addedOn)}</p>
      </div>
    </>
  )
}
