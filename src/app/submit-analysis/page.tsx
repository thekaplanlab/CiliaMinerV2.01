'use client'

/**
 * /submit-analysis — now redirects to /gene-set-analysis.
 *
 * The previous Submit Analysis tool was a three-mode predecessor
 * (gene list / disease list / symptom list) of what's now split between
 * /gene-set-analysis (gene list) and /ciliosymptom (symptoms).  We keep
 * this route as a redirect so external links and bookmarks don't break.
 */

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SubmitAnalysisRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/gene-set-analysis')
  }, [router])

  return (
    <div style={{
      padding:    '6rem 1.5rem',
      textAlign:  'center',
      color:      '#78716c',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <p style={{ fontSize: '14px', marginBottom: '0.75rem' }}>
        Submit Analysis has moved.
      </p>
      <p style={{ fontSize: '12px' }}>
        Redirecting to{' '}
        <Link
          href="/gene-set-analysis"
          style={{ color: '#991b1b', textDecoration: 'underline', textUnderlineOffset: '2px' }}
        >
          Gene Set Analysis
        </Link>
        …
      </p>
    </div>
  )
}
