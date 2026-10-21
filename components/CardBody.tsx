import type {ResourceCardData} from '@/lib/sanity/types'
import {CardCover} from './CardCover'
import styles from './ResourceCard.module.css'

export function CardBody({resource, hideTitle}: {resource: ResourceCardData; hideTitle?: boolean}) {
  return (
    <>
      <div className={styles.cover}>
        <CardCover resource={resource} />
      </div>
      {hideTitle ? (
        <h3 className="visually-hidden">{resource.title}</h3>
      ) : (
        <div className={styles.body}>
          <h3 className={styles.title}>{resource.title}</h3>
        </div>
      )}
    </>
  )
}
