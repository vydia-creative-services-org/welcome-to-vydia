'use client'
import {useEffect, useEffectEvent, useRef, useState} from 'react'
import {coverSource, urlFor} from '@/lib/sanity/image'
import type {ResourceCardData} from '@/lib/sanity/types'
import styles from './ResourceCarousel.module.css'
import {ResourceCard} from './ResourceCard'
import {useScrollInertia} from './useScrollInertia'

/** Backdrop layers kept mounted so outgoing ones can finish fading while new ones fade in. */
const MAX_BACKDROP_LAYERS = 4

/** The cover's tiny blurred placeholder ships with the page, so the backdrop never waits on a download. */
function backdropSrc(resource: ResourceCardData): string | null {
  const source = resource.cover && coverSource(resource.cover)
  if (!source) return null
  return resource.cover?.asset?.lqip ?? urlFor(source).width(64).height(64).fit('crop').url()
}

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
  const [current, setCurrent] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const cell = useRef(1)
  // The eased scrollTop the visuals are currently drawn at (see useScrollInertia).
  const drawnY = useRef(0)

  const draw = (y: number) => {
    drawnY.current = y
    const pos = Math.min(resources.length - 1, Math.max(0, y / cell.current))
    stage.current?.style.setProperty('--pos', String(pos))
    setCurrent(Math.round(pos))
  }
  useScrollInertia(scroller, draw)
  const redraw = useEffectEvent(() => draw(drawnY.current))

  const scrollToIndex = (index: number) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.current?.scrollTo({top: index * cell.current, behavior: reduce ? 'auto' : 'smooth'})
  }

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const last = resources.length - 1

    const measure = () => {
      const second = el.querySelector<HTMLElement>('[data-snap="1"]')
      cell.current = second?.offsetTop || 1
      redraw()
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
    el.addEventListener('wheel', onWheel, {passive: false})
    return () => {
      clearTimeout(gestureTimer)
      observer.disconnect()
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

  // Crossfade: each newly active resource adds a layer on top; older layers fade out underneath.
  // Updating state during render (rather than in an effect) avoids a frame with the wrong layer.
  // `n` keys each layer, since A → B → A can briefly mount two layers for the same resource.
  const [backdrops, setBackdrops] = useState(() => [{id: activeResource._id, n: 0, src: backdropSrc(activeResource)}])
  const top = backdrops[backdrops.length - 1]
  if (top.id !== activeResource._id) {
    setBackdrops([
      ...backdrops.slice(1 - MAX_BACKDROP_LAYERS),
      {id: activeResource._id, n: top.n + 1, src: backdropSrc(activeResource)},
    ])
  }

  return (
    <section aria-roledescription="carousel" aria-label="Resources" className={styles.carousel}>
      <div className={styles.backdrop} aria-hidden>
        {backdrops.map((layer, index) => (
          <div
            key={layer.n}
            className={styles.backdropLayer}
            data-active={index === backdrops.length - 1 || undefined}
            style={layer.src ? {backgroundImage: `url("${layer.src}")`} : undefined}
          />
        ))}
      </div>

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
        <span key={current} className={styles.titleText}>
          {activeResource.title}
        </span>
      </h2>
    </section>
  )
}
