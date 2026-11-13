import {ExternalLink} from 'lucide-react'
import {cx} from '@/lib/cx'
import controls from './controls.module.css'

type Previewable = {id: string; url: string | null; file: string | null}

export const previewHref = ({id, url, file}: Previewable) =>
  url ? url : file ? `/api/resources/${id}/file` : null

export function PreviewButton({href, title}: {href: string | null; title: string}) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={`Preview ${title}`}
      className={cx(controls.button, controls.ghost, controls.sm)}
    >
      Preview
      <ExternalLink aria-hidden size={14} />
    </a>
  )
}
