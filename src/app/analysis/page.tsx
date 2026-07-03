'use client'

/**
 * The former Statistics page has been merged into /about. Anyone hitting
 * /analysis (old bookmarks, external links, search-engine results) gets
 * bounced to the canonical /about URL.
 *
 * Why a client-side redirect rather than a next.config.js rewrite?
 * The site is `output: 'export'` (static), so server-side redirects aren't
 * available. A small client redirect is reliable, fast, and degrades to a
 * visible link if JS is disabled.
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AnalysisRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/about') }, [router])

  return (
    <div
      className="bg-[#faf9f6] min-h-screen flex items-center justify-center px-6 antialiased"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      <div className="max-w-md text-center">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
          Page moved
        </p>
        <h1 className="text-xl font-bold text-stone-900 mb-3 tracking-tight">
          Statistics is now part of About
        </h1>
        <p className="text-xs text-stone-500 leading-relaxed mb-5">
          Redirecting…
        </p>
        <Link
          href="/about"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-800 text-white text-xs font-semibold rounded hover:bg-red-900 transition"
        >
          Continue to About →
        </Link>
      </div>
    </div>
  )
}
