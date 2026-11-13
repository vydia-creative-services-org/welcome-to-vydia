import Image from 'next/image'
import {FileText} from 'lucide-react'
import {publicImageUrl} from '@/lib/resources/mapping'
import styles from './ResourceThumb.module.css'

export function ResourceThumb({path}: {path: string | null | undefined}) {
  return (
    <span className={styles.thumb} aria-hidden>
      {path ? (
        <Image src={publicImageUrl(path)} alt="" width={40} height={40} unoptimized className={styles.image} />
      ) : (
        <FileText size={16} />
      )}
    </span>
  )
}
