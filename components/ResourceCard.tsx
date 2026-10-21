import type {ResourceCardData} from '@/lib/sanity/types'
import {CardBody} from './CardBody'
import styles from './ResourceCard.module.css'
import {VideoCard} from './VideoCard'

export function resourceHref(resource: ResourceCardData): string | null {
  return resource.type === 'link' ? resource.url : (resource.fileUrl ?? resource.url)
}

/** Whether ResourceCard will render anything for this resource. */
export function hasTarget(resource: ResourceCardData): boolean {
  return resource.type === 'video' ? Boolean(resource.fileUrl) : Boolean(resourceHref(resource))
}

export function ResourceCard({resource, hideTitle}: {resource: ResourceCardData; hideTitle?: boolean}) {
  if (resource.type === 'video') {
    return resource.fileUrl ? <VideoCard resource={resource} src={resource.fileUrl} hideTitle={hideTitle} /> : null
  }
  const href = resourceHref(resource)
  if (!href) return null
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles.card}>
      <CardBody resource={resource} hideTitle={hideTitle} />
    </a>
  )
}
