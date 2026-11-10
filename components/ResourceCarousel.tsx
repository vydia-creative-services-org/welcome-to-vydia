'use client'
import Image from 'next/image'
import {useEffect, useEffectEvent, useLayoutEffect, useRef, useState} from 'react'
import type {ResourceCardData} from '@/lib/resources/types'
import styles from './ResourceCarousel.module.css'
import {ResourceCard} from './ResourceCard'
import {useScrollInertia} from './useScrollInertia'
import {useViewMode} from './ViewMode'

/** Backdrop layers kept mounted so outgoing ones can finish fading while new ones fade in. */
const MAX_BACKDROP_LAYERS = 4

function backdropSrc(resource: ResourceCardData): {full: string; placeholder?: string} | null {
  if (!resource.cover) return null
  return {full: resource.cover.src, placeholder: resource.cover.lqip ?? undefined}
}

/** Quiet time after which a horizontal wheel gesture (incl. trackpad momentum) is over. */
const GESTURE_END_MS = 150
/** Mouse travel (px) before a press becomes a drag, so a plain click still opens the card. */
const DRAG_THRESHOLD = 6
/** How far ahead (ms) a released drag's speed carries it when picking the card to land on. */
const FLING_MS = 150
/** Fallback for browsers without `scrollend`: how long a landing scroll may take. */
const LANDING_MS = 800
/** Matches the stacked (vertical) layout's breakpoint in ResourceCarousel.module.css. */
const STACKED_QUERY = '(max-width: 768px)'

/*
 * The carousel is a real vertical scroll container with scroll-snap, so wheel, trackpad momentum,
 * touch flicks and keyboard scrolling are all the browser's own. One snap "cell" of scroll moves
 * the carousel one resource; the scroll position is fed to CSS as a fractional --pos and the
 * cover-flow transforms are derived from it, so cards track the user's scroll continuously.
 * Sideways trackpad swipes and mouse drags drive the same scroll position from script.
 */
export function ResourceCarousel({resources}: {resources: ResourceCardData[]}) {
  const [current, setCurrent] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
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

  // Keep the view switch informed of the card being looked at, and open on it when switching back
  // from the grid. That has to happen in a layout effect, so the carousel is already in place when
  // the view transition captures it (useScrollInertia then starts from this scroll position too).
  const viewMode = useViewMode()
  useEffect(() => {
    viewMode?.setFocus(resources[current].id)
  }, [current, resources, viewMode])
  const openOnFocus = useEffectEvent(() => {
    const el = scroller.current
    const index = resources.findIndex((resource) => resource.id === viewMode?.getFocus())
    if (!el || index <= 0) return
    cell.current = el.querySelector<HTMLElement>('[data-snap="1"]')?.offsetTop || 1
    el.scrollTop = index * cell.current
    draw(el.scrollTop)
  })
  useLayoutEffect(() => openOnFocus(), [])

  const scrollToIndex = (index: number) => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    scroller.current?.scrollTo({top: index * cell.current, behavior: reduce ? 'auto' : 'smooth'})
  }

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const max = () => (resources.length - 1) * cell.current
    const clampTop = (top: number) => Math.min(max(), Math.max(0, top))
    const stacked = window.matchMedia(STACKED_QUERY)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    // Scroll distance per pixel a card moves, so swiped and dragged cards stay under the pointer.
    let ratio = 1

    const measure = () => {
      const second = el.querySelector<HTMLElement>('[data-snap="1"]')
      cell.current = second?.offsetTop || 1
      ratio = cell.current / (track.current?.offsetWidth || cell.current)
      redraw()
    }

    // Snapping would pull every scripted nudge straight back to the nearest card, so it's off while a
    // swipe or drag moves the carousel. On release we glide to a card ourselves, then turn it back on.
    // `top` is tracked here because some browsers round scrollTop, which would swallow small nudges.
    let top = el.scrollTop
    let landing = 0
    const settle = () => {
      clearTimeout(landing)
      el.removeEventListener('scrollend', settle)
      delete el.dataset.free
    }
    const free = () => {
      clearTimeout(landing)
      el.removeEventListener('scrollend', settle)
      if (!('free' in el.dataset) || Math.abs(el.scrollTop - top) > 1) top = el.scrollTop
      el.dataset.free = ''
    }
    const moveTo = (next: number) => {
      top = clampTop(next)
      el.scrollTop = top
    }
    const land = (index: number) => {
      const target = clampTop(Math.round(index) * cell.current)
      if (Math.abs(el.scrollTop - target) < 1) return settle()
      el.addEventListener('scrollend', settle)
      landing = window.setTimeout(settle, LANDING_MS)
      el.scrollTo({top: target, behavior: reduceMotion.matches ? 'auto' : 'smooth'})
    }

    // Vertical scrolling is native. Sideways trackpad swipes (and their momentum) move the cards with
    // the fingers, then land on the nearest card once the gesture goes quiet.
    let gestureEnd = 0
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      if (event.target instanceof Element && event.target.closest('dialog')) return
      event.preventDefault()
      free()
      moveTo(top + event.deltaX * ratio)
      clearTimeout(gestureEnd)
      gestureEnd = window.setTimeout(() => land(top / cell.current), GESTURE_END_MS)
    }

    // Mouse drag along the cards' axis. Touch already scrolls natively, so it's left alone.
    let drag: {
      id: number
      x: number
      y: number
      top: number
      moved: boolean
      samples: {t: number; top: number}[]
    } | null = null
    let swallowClick = false
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      if (event.target instanceof Element && event.target.closest('dialog')) return
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, top: el.scrollTop, moved: false, samples: []}
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const distance = stacked.matches ? event.clientY - drag.y : event.clientX - drag.x
      if (!drag.moved) {
        if (Math.abs(distance) < DRAG_THRESHOLD) return
        drag.moved = true
        el.setPointerCapture(event.pointerId)
        el.dataset.dragging = ''
        free()
      }
      moveTo(drag.top - distance * ratio)
      drag.samples = [...drag.samples.filter((s) => event.timeStamp - s.t < 100), {t: event.timeStamp, top}]
    }
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      const {moved, samples} = drag
      drag = null
      if (!moved) return
      delete el.dataset.dragging
      // The card under the pointer was let go of: its click shouldn't open it.
      swallowClick = event.type === 'pointerup'
      setTimeout(() => (swallowClick = false))
      const first = samples[0]
      const latest = samples[samples.length - 1]
      const speed = latest && latest.t > first.t ? (latest.top - first.top) / (latest.t - first.t) : 0
      land((top + speed * FLING_MS) / cell.current)
    }
    const onClick = (event: MouseEvent) => {
      if (!swallowClick) return
      swallowClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    // Links and cover images are natively draggable, which would steal the gesture.
    const onDragStart = (event: DragEvent) => event.preventDefault()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    el.addEventListener('wheel', onWheel, {passive: false})
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('click', onClick, true)
    el.addEventListener('dragstart', onDragStart)
    return () => {
      clearTimeout(gestureEnd)
      settle()
      delete el.dataset.dragging
      observer.disconnect()
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('click', onClick, true)
      el.removeEventListener('dragstart', onDragStart)
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
  const [backdrops, setBackdrops] = useState(() => [{id: activeResource.id, n: 0, src: backdropSrc(activeResource)}])
  const top = backdrops[backdrops.length - 1]
  if (top.id !== activeResource.id) {
    setBackdrops([
      ...backdrops.slice(1 - MAX_BACKDROP_LAYERS),
      {id: activeResource.id, n: top.n + 1, src: backdropSrc(activeResource)},
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
            style={layer.src?.placeholder ? {backgroundImage: `url("${layer.src.placeholder}")`} : undefined}
          >
            {layer.src && (
              <Image
                src={layer.src.full}
                alt=""
                fill
                sizes="100vw"
                className={styles.backdropImage}
                onLoad={(event) => (event.currentTarget.dataset.loaded = '')}
              />
            )}
          </div>
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
          <div className={styles.slides}>
            {resources.map((resource, index) => {
              const isActive = index === current
              return (
                <div
                  key={resource.id}
                  className={styles.slide}
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${resources.length}`}
                  aria-hidden={!isActive}
                  // Fallback stacking for engines that flatten the 3D layer. It swaps at the halfway
                  // point, where the eased layout keeps the two swapping cards apart, so it can't flick.
                  // TODO(revisit): only safe while --ease keeps that gap; see .slides/.slide in the CSS.
                  style={{'--i': index, zIndex: resources.length - Math.abs(index - current)} as React.CSSProperties}
                >
                  <div
                    inert={!isActive}
                    className={styles.card}
                    data-morph-id={resource.id}
                    data-morph-depth={Math.abs(index - current)}
                  >
                    <ResourceCard resource={resource} hideTitle />
                  </div>
                  {/* Always mounted (the focused card switches it off in CSS): adding/removing it as the
                      focus changes mid-scroll can make browsers rebuild the card's 3D layer and flash.
                      TODO(revisit): speculative GPU-only fix, unverified on real devices. */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-hidden
                    className={styles.hit}
                    onClick={() => scrollToIndex(index)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Scroll length and snap points: one cell of scrolling per resource. */}
        <div ref={track} className={styles.track} aria-hidden>
          {resources.map((resource, index) => (
            <span
              key={resource.id}
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
          <span className={styles.titleType}>{activeResource.category}</span>
        </span>
      </h2>
    </section>
  )
}
