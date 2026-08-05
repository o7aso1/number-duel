import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Cairo, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

const monoDigits = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-digits',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'مبارزة الأرقام',
  description: 'تحدّى صاحبك في تخمين الأرقام — لعبة تخمين أرقام سريعة لشخصين.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  themeColor: '#12241b',
  colorScheme: 'dark',
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-theme="classic"
      className={`${cairo.variable} ${monoDigits.variable} bg-background`}
    >
      <body className="font-sans antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
