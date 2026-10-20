'use client'
import {createContext, useContext, useState} from 'react'

export type ViewMode = 'carousel' | 'grid'

type ViewModeContext = {view: ViewMode; setView: (view: ViewMode) => void}

const Context = createContext<ViewModeContext | null>(null)

export function ViewModeProvider({children}: {children: React.ReactNode}) {
  const [view, setView] = useState<ViewMode>('carousel')
  return <Context value={{view, setView}}>{children}</Context>
}

/** Null outside a ViewModeProvider, so pages without resources render no toggle. */
export const useViewMode = () => useContext(Context)
