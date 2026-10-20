import {LaunchIcon} from '@sanity/icons/Launch'
import type {DocumentActionComponent} from 'sanity'
import {currentSlug} from './currentSlug'

export const OpenSiteAction: DocumentActionComponent = (props) => {
  const current = currentSlug(props.published)
  if (!current) return null
  return {
    label: 'Open site',
    icon: LaunchIcon,
    onHandle: () => window.open(`${process.env.NEXT_PUBLIC_SITE_URL}/${current}`, '_blank', 'noopener'),
  }
}
