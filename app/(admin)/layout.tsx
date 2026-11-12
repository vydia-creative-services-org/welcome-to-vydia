import type {Metadata} from 'next'
import {Public_Sans, Roboto_Mono} from 'next/font/google'
import {Analytics} from '@vercel/analytics/next'
import {SpeedInsights} from '@vercel/speed-insights/next'
import {THEME_SCRIPT} from '@/components/admin/theme'
import './admin.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})
const mono = Roboto_Mono({subsets: ['latin'], variable: '--font-roboto-mono'})

export const metadata: Metadata = {title: 'Vydia Onboarding · Admin', robots: {index: false, follow: false}}

export default function AdminRootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: THEME_SCRIPT}} />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
