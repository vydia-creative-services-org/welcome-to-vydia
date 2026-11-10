import Image from 'next/image'
import type {ResourceCardData} from '@/lib/resources/types'
import styles from './CardCover.module.css'

export function CardCover({resource}: {resource: ResourceCardData}) {
  const {cover, title} = resource
  if (cover) {
    return (
      <Image
        src={cover.src}
        alt={cover.alt}
        fill
        sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
        className={styles.image}
        style={{objectPosition: cover.position}}
        placeholder={cover.lqip ? 'blur' : 'empty'}
        blurDataURL={cover.lqip ?? undefined}
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
