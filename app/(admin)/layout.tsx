import type {Metadata} from 'next'
import {Public_Sans} from 'next/font/google'
import './admin.css'

const sans = Public_Sans({subsets: ['latin'], variable: '--font-public-sans'})

export const metadata: Metadata = {title: 'Welcome to Vydia · Admin', robots: {index: false, follow: false}}

export default function AdminRootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  )
}
