import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'CiliaMiner - Ciliopathy Genes and Ciliopathies',
  description: 'An integrated database for ciliopathy genes and ciliopathies. Search for genes, explore diseases, and analyze clinical features.',
  keywords: 'ciliopathy, genes, diseases, database, research, genetics',
  authors: [{ name: 'Kaplan Lab' }],
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
