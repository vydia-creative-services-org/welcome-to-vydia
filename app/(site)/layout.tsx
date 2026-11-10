import type {Metadata} from 'next'
import {Public_Sans} from 'next/font/google'
import {Analytics} from '@vercel/analytics/next'
import {SpeedInsights} from '@vercel/speed-insights/next'
import './globals.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})

export const metadata: Metadata = {title: 'Welcome to Vydia', robots: {index: false, follow: false}}

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
