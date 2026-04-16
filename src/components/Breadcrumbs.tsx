'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export interface Crumb {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  trail: Crumb[]
}

/**
 * Editorial breadcrumbs — small, uppercase, flush to the left edge.
 * Always starts with the implicit "Home" link unless the first crumb is home.
 */
export function Breadcrumbs({ trail }: BreadcrumbsProps) {
  const withHome: Crumb[] =
    trail.length === 0 || trail[0].href === '/' ? trail : [{ label: 'Home', href: '/' }, ...trail]

  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-medium text-primary-400">
        {withHome.map((crumb, i) => {
          const last = i === withHome.length - 1
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
              {crumb.href && !last ? (
                <Link
                  href={crumb.href}
                  className="hover:text-accent transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? 'text-primary-700' : ''}>{crumb.label}</span>
              )}
              {!last && <ChevronRight className="h-3 w-3 text-primary-200" aria-hidden />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
