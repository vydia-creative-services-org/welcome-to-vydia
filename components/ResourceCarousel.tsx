'use client'
import Image from 'next/image'
import {useEffect, useRef, useState} from 'react'
import {coverSource, urlFor} from '@/lib/sanity/image'
import type {ResourceCardData} from '@/lib/sanity/types'
import styles from './ResourceCarousel.module.css'
import {ResourceCard} from './ResourceCard'

/** Accumulated horizontal wheel distance that counts as one sideways swipe. */
const SWIPE_THRESHOLD = 30
/** Quiet time after which a horizontal wheel gesture (incl. trackpad momentum) is over. */
const GESTURE_END_MS = 200

/*
 * The carousel is a real vertical scroll container with scroll-snap, so wheel, trackpad momentum,
 * touch flicks and keyboard scrolling are all the browser's own. One snap "cell" of scroll moves
 * the carousel one resource; the scroll position is fed to CSS as a fractional --pos and the
 * cover-flow transforms are derived from it, so cards track the user's scroll continuously.
 */
export function ResourceCarousel({resources}: {resources: ResourceCardData[]}) {
  // `dir` is which way we last moved (1 = next, -1 = previous), so the title can enter from that side.
  const [{index: current, dir}, setActive] = useState({index: 0, dir: 1})
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const cell = useRef(1)

  const scrollToIndex = (index: number) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.current?.scrollTo({top: index * cell.current, behavior: reduce ? 'auto' : 'smooth'})
  }

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const last = resources.length - 1

    const sync = () => {
      const pos = Math.min(last, Math.max(0, el.scrollTop / cell.current))
      stage.current?.style.setProperty('--pos', String(pos))
      const index = Math.round(pos)
      setActive((prev) => (prev.index === index ? prev : {index, dir: Math.sign(index - prev.index)}))
    }
    const measure = () => {
      const second = el.querySelector<HTMLElement>('[data-snap="1"]')
      cell.current = second?.offsetTop || 1
      sync()
    }

    // Vertical scrolling is native. Sideways trackpad swipes have no native axis to scroll, so each
    // swipe gesture steps one resource (momentum events are absorbed until the gesture goes quiet).
    let accumulated = 0
    let stepped = false
    let gestureTimer: ReturnType<typeof setTimeout> | undefined
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      if (event.target instanceof Element && event.target.closest('dialog')) return
      event.preventDefault()
      clearTimeout(gestureTimer)
      gestureTimer = setTimeout(() => {
        accumulated = 0
        stepped = false
      }, GESTURE_END_MS)
      if (stepped) return
      accumulated += event.deltaX
      if (Math.abs(accumulated) < SWIPE_THRESHOLD) return
      stepped = true
      const target = Math.round(el.scrollTop / cell.current) + Math.sign(accumulated)
      el.scrollTo({top: Math.min(last, Math.max(0, target)) * cell.current, behavior: 'smooth'})
    }

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    el.addEventListener('scroll', sync, {passive: true})
    el.addEventListener('wheel', onWheel, {passive: false})
    return () => {
      clearTimeout(gestureTimer)
      observer.disconnect()
      el.removeEventListener('scroll', sync)
      el.removeEventListener('wheel', onWheel)
    }
  }, [resources.length])

  // Up/Down/Page/Home/End/Space scroll natively; Left/Right match the desktop layout.
  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    scrollToIndex(Math.min(resources.length - 1, Math.max(0, current + delta)))
  }

  const activeResource = resources[current]
  const backdrop = activeResource.cover && coverSource(activeResource.cover)

  return (
    <section aria-roledescription="carousel" aria-label="Resources" className={styles.carousel}>
      {backdrop && (
        <div className={styles.backdrop} aria-hidden>
          <Image
            key={activeResource._id}
            src={urlFor(backdrop).width(200).height(200).fit('crop').url()}
            alt=""
            fill
            sizes="200px"
            className={styles.backdropImage}
          />
        </div>
      )}

      <div
        ref={scroller}
        className={styles.scroller}
        style={{'--count': resources.length} as React.CSSProperties}
        tabIndex={0}
        aria-label="Scroll or use arrow keys to browse resources"
        onKeyDown={onKeyDown}
      >
        <div ref={stage} className={styles.stage}>
          {resources.map((resource, index) => {
            const isActive = index === current
            return (
              <div
                key={resource._id}
                className={styles.slide}
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${resources.length}`}
                aria-hidden={!isActive}
                style={{'--i': index, zIndex: resources.length - Math.abs(index - current)} as React.CSSProperties}
              >
                <div inert={!isActive}>
                  <ResourceCard resource={resource} hideTitle />
                </div>
                {!isActive && (
                  <button type="button" tabIndex={-1} className={styles.hit} onClick={() => scrollToIndex(index)} />
                )}
              </div>
            )
          })}
        </div>

        {/* Scroll length and snap points: one cell of scrolling per resource. */}
        <div className={styles.track} aria-hidden>
          {resources.map((resource, index) => (
            <span
              key={resource._id}
              data-snap={index}
              className={styles.snap}
              style={{'--i': index} as React.CSSProperties}
            />
          ))}
        </div>
      </div>

      <h2 className={styles.title} aria-live="polite">
        {/* Keyed so each new title remounts and replays its entrance. */}
        <span key={current} className={styles.titleText} style={{'--dir': dir} as React.CSSProperties}>
          {activeResource.title}
        </span>
      </h2>
    </section>
  )
}
