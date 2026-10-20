'use client'
import {useEffect, useEffectEvent} from 'react'

/** How far the visuals trail the real scroll: roughly the time (ms) to close 63% of the gap. */
const INERTIA_MS = 80

/**
 * Adds a touch of inertia on top of native scrolling. The element still scrolls natively (wheel,
 * trackpad momentum, touch flicks, keyboard), but `onFrame` receives a scrollTop that eases toward
 * the real one each animation frame, so whatever it drives glides into place instead of tracking 1:1.
 */
export function useScrollInertia(scroller: React.RefObject<HTMLElement | null>, onFrame: (y: number) => void) {
  const frame = useEffectEvent(onFrame)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let y = el.scrollTop
    let raf = 0
    let lastTime = 0

    const tick = (now: number) => {
      const target = el.scrollTop
      const dt = lastTime ? now - lastTime : 16
      lastTime = now
      y = reduceMotion.matches ? target : target + (y - target) * Math.exp(-dt / INERTIA_MS)
      if (Math.abs(target - y) < 0.1) y = target
      frame(y)
      if (y === target) {
        raf = 0
        lastTime = 0
      } else {
        raf = requestAnimationFrame(tick)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }

    frame(y)
    el.addEventListener('scroll', onScroll, {passive: true})
    return () => {
      el.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [scroller])
}
