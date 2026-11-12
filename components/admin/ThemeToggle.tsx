'use client'
import {Moon, Sun} from 'lucide-react'
import {useSyncExternalStore} from 'react'
import controls from './controls.module.css'
import {THEME_KEY, type Theme} from './theme'
import styles from './ThemeToggle.module.css'
import {cx} from '@/lib/cx'

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')
const systemTheme = (): Theme => (darkQuery().matches ? 'dark' : 'light')

function readTheme(): Theme {
  const value = document.documentElement.dataset.theme
  return value === 'light' || value === 'dark' ? value : systemTheme()
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']})
  const query = darkQuery()
  query.addEventListener('change', onChange)
  return () => {
    observer.disconnect()
    query.removeEventListener('change', onChange)
  }
}

function applyTheme(next: Theme) {
  const root = document.documentElement
  try {
    if (next === systemTheme()) {
      localStorage.removeItem(THEME_KEY)
      delete root.dataset.theme
    } else {
      localStorage.setItem(THEME_KEY, next)
      root.dataset.theme = next
    }
  } catch {
    root.dataset.theme = next
  }
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => null)

  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce && document.startViewTransition) document.startViewTransition(() => applyTheme(next))
    else applyTheme(next)
  }

  return (
    <button
      type="button"
      className={cx(controls.button, controls.ghost, styles.row)}
      aria-pressed={theme === null ? undefined : theme === 'dark'}
      onClick={toggle}
    >
      <Moon aria-hidden size={14} className={styles.dark} />
      <Sun aria-hidden size={14} className={styles.light} />
      Dark theme
      <span aria-hidden className={styles.switch} />
    </button>
  )
}
