'use client'
import {createContext, useContext, useState} from 'react'
import {flushSync} from 'react-dom'

export type ViewMode = 'carousel' | 'grid'

type ViewModeContext = {view: ViewMode; setView: (view: ViewMode) => void}

const Context = createContext<ViewModeContext | null>(null)

/** Every card in either view carries this attribute so the switch can pair them up. */
const MORPH_ITEMS = '[data-morph-id]'

/** Above every card's stacking slot, below the header/footer (z-index 100 in globals.css). */
const MAX_CARD_Z = 99

/**
 * Give each card a shared view-transition name, so the browser moves it from its old spot to its
 * new one. Returns z-index rules for the cards' transition groups: by default they'd stack in
 * document order (card 12 over card 1), so carousel cards keep their carousel stacking instead,
 * the focused card on top and the rest beneath it by distance.
 */
function nameCards(on: boolean): string {
  let rules = ''
  document.querySelectorAll<HTMLElement>(MORPH_ITEMS).forEach((card) => {
    const name = `resource-${card.dataset.morphId!.replace(/[^\w-]/g, '_')}`
    card.style.setProperty('view-transition-name', on ? name : '')
    card.style.setProperty('view-transition-class', on ? 'resource-morph' : '')
    const depth = card.dataset.morphDepth
    if (on && depth) rules += `::view-transition-group(${name}){z-index:${Math.max(1, MAX_CARD_Z - Number(depth))}}`
  })
  return rules
}

export function ViewModeProvider({children}: {children: React.ReactNode}) {
  const [view, setView] = useState<ViewMode>('carousel')

  // Names are only applied for the duration of the switch: while named, a card is captured on
  // every view transition and the browser skips it when hit-testing during one.
  const switchView = (next: ViewMode) => {
    if (next === view) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduceMotion) return setView(next)

    // Only one side of the switch is the carousel, so only it contributes stacking rules.
    const stacking = document.createElement('style')
    stacking.textContent = nameCards(true)
    document.head.append(stacking)
    const transition = document.startViewTransition(() => {
      flushSync(() => setView(next))
      stacking.textContent += nameCards(true)
    })
    void transition.finished.finally(() => {
      nameCards(false)
      stacking.remove()
    })
  }

  return <Context value={{view, setView: switchView}}>{children}</Context>
}

/** Null outside a ViewModeProvider, so pages without resources render no toggle. */
export const useViewMode = () => useContext(Context)
