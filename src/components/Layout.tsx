'use client'

/**
 * Layout — shared site chrome.
 *
 *   Header — single white bar (h-14 on mobile, h-16 on desktop):
 *     [Logo] CiliaMiner v15  | Nav (inline) | Theme toggle
 *
 *   Mobile (< md) stacks the nav into a second row that wraps freely
 *   so all six items remain visible.
 *
 *   Footer — copyright + citation, sticks to bottom on short pages.
 */

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

const NAV: Array<{ name: string; href: string }> = [
  { name: 'Search',          href: '/advanced-search' },
  { name: 'Classification',  href: '/ciliopathy-classification' },
  { name: 'Symptoms',        href: '/symptoms-diseases' },
  { name: 'Compare',         href: '/compare-diseases' },
  { name: 'CilioSymptom',    href: '/ciliosymptom' },
  { name: 'Gene Sets',       href: '/gene-set-analysis' },
  { name: 'Publications',    href: '/publications' },
  { name: 'About',           href: '/about' },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#faf9f6] text-stone-800 min-h-screen flex flex-col antialiased">
      <SiteHeader />
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}

// ── Logo (same artwork as /icon.svg) ──────────────────────────────────

function Logo({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#991b1b" />
      <text
        x="16" y="22.5"
        textAnchor="middle"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', system-ui, sans-serif"
        fontWeight="800"
        fontSize="20"
        fill="#ffffff"
      >C</text>
    </svg>
  )
}

// ── Header ─────────────────────────────────────────────────────────────

function SiteHeader() {
  const pathname = usePathname()

  const wordmark = (
    <Link
      href="/"
      className="flex items-center gap-2.5 text-base font-bold tracking-tight text-stone-900 hover:opacity-80 transition whitespace-nowrap shrink-0"
    >
      <Logo className="w-6 h-6 shrink-0" />
      <span>
        Cilia<span className="text-red-800">Miner</span>
        <span className="ml-1.5 text-[11px] font-normal text-stone-400 font-mono align-baseline">
          v15
        </span>
      </span>
    </Link>
  )

  const navLinks = NAV.map((item) => {
    const isActive =
      pathname === item.href ||
      (item.href !== '/' && pathname?.startsWith(item.href))
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`text-sm font-semibold whitespace-nowrap px-3 py-1.5 rounded transition ${
          isActive
            ? 'bg-red-800 text-white'
            : 'text-stone-600 hover:bg-stone-100'
        }`}
      >
        {item.name}
      </Link>
    )
  })

  return (
    <header className="bg-white border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-6">
        {/* Mobile / narrow desktop (< lg): wordmark + toggle top row, nav wraps below */}
        <div className="lg:hidden">
          <div className="h-14 flex items-center justify-between">
            {wordmark}
            <ThemeToggle />
          </div>
          <div className="pb-2 -mt-1 flex flex-wrap gap-1.5">
            {navLinks}
          </div>
        </div>

        {/* Wide desktop (≥ lg): everything on one row, no wrap */}
        <div className="hidden lg:flex h-16 items-center gap-4">
          {wordmark}
          <nav className="flex items-center gap-1 flex-1 flex-nowrap">
            {navLinks}
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

// ── Footer ─────────────────────────────────────────────────────────────

function SiteFooter() {
  return (
    <footer className="bg-white border-t border-stone-200 py-4 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center text-xs text-stone-400 gap-2">
        <div>© 2026 Rare Disease Laboratory — Abdullah Gül University</div>
        <div className="text-stone-500">
          Cite:{' '}
          <span className="italic text-stone-400">
            Turan M.G., Orhan M.E., et al., Database 2023
          </span>
        </div>
      </div>
    </footer>
  )
}

// ── Theme toggle ───────────────────────────────────────────────────────

function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  const isDark = resolved === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="text-stone-500 hover:text-stone-900 transition shrink-0"
    >
      {isDark ? (
        <Sun className="w-4 h-4" aria-hidden="true" />
      ) : (
        <Moon className="w-4 h-4" aria-hidden="true" />
      )}
    </button>
  )
}
