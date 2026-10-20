import type {BlockContent} from '@/lib/sanity/types.generated'
import {RichText} from './RichText'

export function Intro({value}: {value: BlockContent}) {
  if (!value.length) return null
  return (
    <section aria-label="Introduction">
      <RichText value={value} />
    </section>
  )
}
