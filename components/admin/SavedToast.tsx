'use client'
import {usePathname, useRouter} from 'next/navigation'
import {useEffect, useRef} from 'react'
import {useToast} from './Toaster'

export function SavedToast() {
  const toast = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current) return
    shown.current = true
    toast('Saved', 'success')
    router.replace(pathname, {scroll: false})
  }, [toast, router, pathname])

  return null
}
