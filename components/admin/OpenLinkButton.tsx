import {ExternalLink} from 'lucide-react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'

export function OpenLinkButton({slug}: {slug: string}) {
  return (
    <a href={`/${slug}`} target="_blank" rel="noopener" className={cx(controls.button, controls.sm)}>
      Open
      <ExternalLink aria-hidden size={14} strokeWidth={2} />
    </a>
  )
}
