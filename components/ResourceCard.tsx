import type {ResourceCardData} from '@/lib/sanity/types'
import {CardBody} from './CardBody'
import styles from './ResourceCard.module.css'
import {VideoCard} from './VideoCard'

export function resourceHref(resource: ResourceCardData): string | null {
  return resource.type === 'link' ? resource.url : (resource.fileUrl ?? resource.url)
}

export function ResourceCard({resource}: {resource: ResourceCardData}) {
  if (resource.type === 'video') {
    return resource.fileUrl ? <VideoCard resource={resource} src={resource.fileUrl} /> : null
  }
  const href = resourceHref(resource)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      <CardBody resource={resource} />
    </a>
  )
}
