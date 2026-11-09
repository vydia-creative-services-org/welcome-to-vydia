import type {ResourceType} from '@/lib/resources/types'
import styles from './TypeLabel.module.css'

const LABELS: Record<ResourceType, string> = {pdf: 'PDF', video: 'Video', link: 'Link', slides: 'Slides'}

export const typeLabel = (type: ResourceType) => LABELS[type]

export function TypeLabel({type}: {type: ResourceType}) {
  return (
    <span className={styles.label} data-type={type}>
      {LABELS[type]}
    </span>
  )
}
