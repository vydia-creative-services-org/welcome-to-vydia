import type {ResourceCardData} from '@/lib/resources/types'
import {CardBody} from './CardBody'
import styles from './ResourceCard.module.css'
import {VideoCard} from './VideoCard'

export function ResourceCard({resource, hideTitle}: {resource: ResourceCardData; hideTitle?: boolean}) {
  if (resource.type === 'video') return <VideoCard resource={resource} src={resource.href} hideTitle={hideTitle} />
  return (
    <a href={resource.href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      <CardBody resource={resource} hideTitle={hideTitle} />
    </a>
  )
}
