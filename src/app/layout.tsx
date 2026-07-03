import './globals.css'
import type { Metadata } from 'next'
import { ThemeProvider, PRE_HYDRATION_SCRIPT } from '@/lib/theme'

export const metadata: Metadata = {
  title: 'CiliaMiner',
  description:
    'A curated reference for ciliopathy genes and the diseases they cause — searchable, with HPO-linked clinical features.',
  icons: {
    icon:     [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple:    [{ url: '/icon.svg', type: 'image/svg+xml' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Font preconnect + load. We use <link> tags rather than @import
            in globals.css because CSS spec requires @import to precede all
            other rules and Turbopack enforces that strictly. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
        {/*
          This script runs BEFORE React hydration. It reads the theme from
          localStorage and sets data-theme on <html> so the first paint is
          already in the right colour mode (no flash). suppressHydrationWarning
          tells React not to flag the attribute mismatch.
        */}
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
