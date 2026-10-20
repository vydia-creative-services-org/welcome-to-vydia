import {PortableText, type PortableTextComponents} from '@portabletext/react'
import type {BlockContent} from '@/lib/sanity/types.generated'
import styles from './RichText.module.css'

const components: PortableTextComponents = {
  marks: {
    link: ({value, children}) => (
      <a href={value?.href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    ),
  },
}

export function RichText({value}: {value: BlockContent}) {
  return (
    <div className={styles.richText}>
      <PortableText value={value} components={components} />
    </div>
  )
}
