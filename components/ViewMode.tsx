'use client'
import {createContext, useContext, useLayoutEffect, useRef, useState} from 'react'
import {flushSync} from 'react-dom'

export type ViewMode = 'carousel' | 'grid'

type ViewModeContext = {
  view: ViewMode
  setView: (view: ViewMode) => void
  /** Switch to the other view (relative to any switch already queued). */
  toggleView: () => void
  /** The resource the user is looking at; the incoming view opens on it. */
  getFocus: () => string | null
  setFocus: (id: string) => void
}

const Context = createContext<ViewModeContext | null>(null)

/** Every card in either view carries this attribute so the switch can pair them up. */
const MORPH_ITEMS = '[data-morph-id]'

/** Above every card's stacking slot, below the header/footer (z-index 100 in globals.css). */
const MAX_CARD_Z = 99

/** Cascade: each card sets off a little after the one nearer the focused card, up to a cap. */
const STAGGER_MS = 14
const MAX_STAGGER_MS = 84

/** Header height; grid cards hidden under it don't count as being looked at. */
const HEADER_PX = 120

/**
 * Give each card a shared view-transition name, so the browser moves it from its old spot to its
 * new one. Returns per-card rules for the transition:
 * - z-index: by default the cards would stack in document order (card 12 over card 1), so carousel
 *   cards keep their carousel stacking instead, the focused card on top, the rest by distance.
 * - delay: cards set off in a quick cascade outward from the focused card. The image crossfade is
 *   delayed with the movement, so no card fades in place before it moves.
 */
function nameCards(on: boolean, focus: string | null): string {
  const cards = [...document.querySelectorAll<HTMLElement>(MORPH_ITEMS)]
  const focusIndex = Math.max(
    0,
    cards.findIndex((card) => card.dataset.morphId === focus),
  )
  let rules = ''
  cards.forEach((card, index) => {
    const name = `resource-${card.dataset.morphId!.replace(/[^\w-]/g, '_')}`
    card.style.setProperty('view-transition-name', on ? name : '')
    card.style.setProperty('view-transition-class', on ? 'resource-morph' : '')
    if (!on) return
    const depth = card.dataset.morphDepth
    if (depth) rules += `::view-transition-group(${name}){z-index:${Math.max(1, MAX_CARD_Z - Number(depth))}}`
    const delay = Math.min(Math.abs(index - focusIndex) * STAGGER_MS, MAX_STAGGER_MS)
    if (delay) {
      rules += `::view-transition-group(${name}),::view-transition-old(${name}),::view-transition-new(${name}){animation-delay:${delay}ms}`
    }
  })
  return rules
}

/** Flags the page while a switch runs, so cards can drop their carousel shadow for the flight. */
function markSwitching(on: boolean) {
  if (on) document.documentElement.dataset.viewSwitching = ''
  else delete document.documentElement.dataset.viewSwitching
}

/** The first grid card that's actually on screen, in reading order. */
function firstVisibleCardId(): string | null {
  for (const card of document.querySelectorAll<HTMLElement>(MORPH_ITEMS)) {
    const {top, bottom} = card.getBoundingClientRect()
    if (bottom > HEADER_PX && top < window.innerHeight) return card.dataset.morphId ?? null
  }
  return null
}

export function ViewModeProvider({children}: {children: React.ReactNode}) {
  const [view, setView] = useState<ViewMode>('carousel')
  const viewRef = useRef(view)
  useLayoutEffect(() => {
    viewRef.current = view
  }, [view])
  const focusId = useRef<string | null>(null)
  // A click during a switch waits for it to finish instead of cutting it off.
  const running = useRef(false)
  const queued = useRef<ViewMode | null>(null)

  // Names are only applied for the duration of the switch: while named, a card is captured on
  // every view transition and the browser skips it when hit-testing during one.
  const switchView = (next: ViewMode) => {
    if (running.current) {
      queued.current = next
      return
    }
    if (next === viewRef.current) return
    // Leaving the grid: whatever's at the top of the screen becomes the carousel's starting card.
    if (viewRef.current === 'grid') focusId.current = firstVisibleCardId() ?? focusId.current

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduceMotion) return setView(next)

    // Only one side of the switch is the carousel, so only it contributes stacking rules.
    const stacking = document.createElement('style')
    stacking.textContent = nameCards(true, focusId.current)
    document.head.append(stacking)
    running.current = true
    // Lets cards drop their carousel shadow for the flight (see .card in ResourceCarousel.module.css).
    markSwitching(true)
    const transition = document.startViewTransition(() => {
      flushSync(() => setView(next))
      stacking.textContent += nameCards(true, focusId.current)
    })
    void transition.finished.finally(() => {
      nameCards(false, null)
      stacking.remove()
      markSwitching(false)
      running.current = false
      const pending = queued.current
      queued.current = null
      if (pending && pending !== viewRef.current) switchView(pending)
    })
  }

  const getFocus = () => focusId.current
  const setFocus = (id: string) => {
    focusId.current = id
  }

  const toggleView = () => {
    const target = queued.current ?? viewRef.current
    switchView(target === 'grid' ? 'carousel' : 'grid')
  }

  return <Context value={{view, setView: switchView, toggleView, getFocus, setFocus}}>{children}</Context>
}

/** Null outside a ViewModeProvider, so pages without resources render no toggle. */
export const useViewMode = () => useContext(Context)
