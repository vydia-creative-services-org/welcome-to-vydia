import {FileText, Link2, Play, Presentation, type LucideIcon} from 'lucide-react'
import {cx} from '@/lib/cx'
import type {ResourceType} from '@/sanity/schemaTypes/resource'
import styles from './FileTypeBadge.module.css'

const BADGES: Record<ResourceType, {Icon: LucideIcon; label: string}> = {
  pdf: {Icon: FileText, label: 'PDF'},
  video: {Icon: Play, label: 'Video'},
  link: {Icon: Link2, label: 'Link'},
  slides: {Icon: Presentation, label: 'Slide deck'},
}

export function FileTypeBadge({type, className}: {type: ResourceType; className?: string}) {
  const {Icon, label} = BADGES[type]
  return (
    <span className={cx(styles.badge, styles[type], className)}>
      <Icon aria-hidden className={styles.icon} strokeWidth={2.5} />
      <span className="visually-hidden">{label}</span>
    </span>
  )
}
