'use client'
import {X} from 'lucide-react'
import {useRef} from 'react'
import type {ResourceCardData} from '@/lib/resources/types'
import {CardBody} from './CardBody'
import cardStyles from './ResourceCard.module.css'
import styles from './VideoCard.module.css'

export function VideoCard({resource, src, hideTitle}: {resource: ResourceCardData; src: string; hideTitle?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  const open = () => {
    dialog.current?.showModal()
    void video.current?.play().catch(() => {})
  }

  const handleClose = () => {
    video.current?.pause()
    trigger.current?.focus()
  }

  return (
    <>
      <button ref={trigger} type="button" className={cardStyles.card} onClick={open} aria-haspopup="dialog">
        <CardBody resource={resource} hideTitle={hideTitle} />
      </button>
      <dialog ref={dialog} onClose={handleClose} className={styles.dialog} aria-label={resource.title}>
        <button type="button" onClick={() => dialog.current?.close()} className={styles.close} aria-label="Close video">
          <X aria-hidden />
        </button>
        <video ref={video} src={src} controls preload="none" playsInline className={styles.video} />
      </dialog>
    </>
  )
}
