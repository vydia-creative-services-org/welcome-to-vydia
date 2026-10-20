import Image from 'next/image'
import {coverSource, urlFor} from '@/lib/sanity/image'
import type {ResourceCardData} from '@/lib/sanity/types'
import styles from './CardCover.module.css'

export function CardCover({resource}: {resource: ResourceCardData}) {
  const {cover, title} = resource
  const source = cover && coverSource(cover)
  if (cover && source) {
    const lqip = cover.asset?.lqip ?? undefined
    return (
      <Image
        src={urlFor(source).maxWidth(800).maxHeight(450).fit('max').url()}
        alt={cover.alt ?? ''}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className={styles.image}
        placeholder={lqip ? 'blur' : 'empty'}
        blurDataURL={lqip}
      />
    )
  }
  return (
    <div className={styles.placeholder}>
      <span className={styles.placeholderTitle}>{title}</span>
      <Image src="/vydia-logo.svg" alt="" width={1233} height={139} className={styles.placeholderLogo} />
    </div>
  )
}
