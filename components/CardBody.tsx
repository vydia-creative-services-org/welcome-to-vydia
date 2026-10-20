import type {ResourceCardData} from '@/lib/sanity/types'
import {CardCover} from './CardCover'
import styles from './ResourceCard.module.css'

export function CardBody({resource}: {resource: ResourceCardData}) {
  return (
    <>
      <div className={styles.cover}>
        <CardCover resource={resource} />
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>{resource.title}</h3>
      </div>
    </>
  )
}
