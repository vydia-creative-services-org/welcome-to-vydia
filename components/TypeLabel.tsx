import type {ResourceType} from '@/lib/resources/types'

const LABELS: Record<ResourceType, string> = {pdf: 'PDF', video: 'Video', link: 'Link', slides: 'Slides'}

export const typeLabel = (type: ResourceType) => LABELS[type]
