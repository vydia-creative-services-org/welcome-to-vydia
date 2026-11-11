import type {Metadata, Viewport} from 'next'
import {Public_Sans} from 'next/font/google'
import {Analytics} from '@vercel/analytics/next'
import {SpeedInsights} from '@vercel/speed-insights/next'
import './globals.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})

export const metadata: Metadata = {title: 'Vydia Onboarding', robots: {index: false, follow: false}}

// viewportFit 'cover' lets the page draw under the iPhone notch / home indicator (full bleed).
export const viewport: Viewport = {viewportFit: 'cover', themeColor: '#1a1a1a'}

export default function SiteLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
