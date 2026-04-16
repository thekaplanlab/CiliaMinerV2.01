'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'

const navigation = [
  { name: 'Search', href: '/advanced-search' },
  { name: 'Classification', href: '/ciliopathy-classification' },
  { name: 'Orthologs', href: '/genes-orthologs' },
  { name: 'Clinical Features', href: '/symptoms-diseases' },
  { name: 'Analysis', href: '/analysis' },
  { name: 'About', href: '/about' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const currentPath = pathname === '/' || !pathname ? '/' : pathname

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  return (
    <div className="min-h-screen bg-surface-muted flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:w-auto focus:h-auto focus:m-0 focus:overflow-visible focus:[clip:auto] focus:bg-surface focus:text-accent focus:rounded-sm focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      >
        Skip to main content
      </a>

      {/* Masthead — editorial header with hairline rule */}
      <nav
        className="bg-surface-muted/90 backdrop-blur-sm border-b border-primary-200/60 sticky top-0 z-50"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="group flex items-baseline gap-2 shrink-0"
            >
              <span className="font-display text-2xl text-primary-700 tracking-tight leading-none group-hover:text-accent transition-colors">
                Cilia<span className="italic text-accent">Miner</span>
              </span>
            </Link>

            {/* Desktop + tablet: horizontal nav */}
            <div className="hidden md:flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {navigation.map((item) => {
                const isActive = currentPath === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'relative px-3 py-1.5 text-sm font-medium tracking-tight whitespace-nowrap transition-colors duration-150',
                      isActive
                        ? 'text-accent'
                        : 'text-primary-500 hover:text-primary-700'
                    )}
                  >
                    {item.name}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-3 right-3 -bottom-0.5 h-px bg-accent"
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center p-2 text-primary-600 hover:text-accent rounded-sm transition-colors"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile menu */}
          <div
            id="mobile-menu"
            className={cn(
              'md:hidden overflow-hidden transition-all duration-200 ease-in-out',
              mobileMenuOpen ? 'max-h-[80vh] opacity-100 pb-4' : 'max-h-0 opacity-0'
            )}
          >
            <div className="space-y-0.5 border-t border-primary-200/50 pt-3 mt-1">
              {navigation.map((item) => {
                const isActive = currentPath === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'block px-3 py-2.5 text-sm font-medium rounded-sm transition-colors duration-150',
                      isActive
                        ? 'text-accent bg-surface'
                        : 'text-primary-600 hover:text-primary-700 hover:bg-surface'
                    )}
                  >
                    {item.name}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </nav>

      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-8 py-10">
        {children}
      </main>

      {/* Colophon — editorial footer */}
      <footer className="border-t border-primary-200/60 bg-surface-muted">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-4">
              <div className="font-display text-xl text-primary-700 mb-3 leading-none">
                Cilia<span className="italic text-accent">Miner</span>
              </div>
              <p className="text-sm text-primary-500 leading-relaxed max-w-xs">
                An integrated reference for ciliopathy genes and associated disorders.
                Maintained by the Kaplan Lab.
              </p>
            </div>
            <div className="md:col-span-3">
              <p className="eyebrow mb-3">Navigate</p>
              <ul className="space-y-1.5">
                {navigation.map((item) => (
                  <li key={item.name}>
                    <Link href={item.href} className="text-sm text-primary-600 hover:text-accent transition-colors">
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-5">
              <p className="eyebrow mb-3">Cite</p>
              <p className="text-sm text-primary-600 leading-relaxed">
                Turan, M. G., et al. (2023). CiliaMiner: an integrated database
                for ciliopathy genes and ciliopathies.{' '}
                <em className="font-display italic">Database</em>, 2023, baad047.
              </p>
              <a
                href="https://doi.org/10.1093/database/baad047"
                target="_blank"
                rel="noopener noreferrer"
                className="link-accent text-sm mt-2 inline-block font-mono"
              >
                10.1093/database/baad047 →
              </a>
              <p className="eyebrow mt-6 mb-2">Contact</p>
              <a
                href="mailto:info@ciliaminer.org"
                className="text-sm text-primary-600 hover:text-accent transition-colors"
              >
                info@ciliaminer.org
              </a>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-primary-200/50 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-primary-400 font-mono">
              © {new Date().getFullYear()} · Kaplan Lab · All rights reserved
            </p>
            <p className="text-xs text-primary-400 tracking-wider uppercase">
              Built for open research
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
