'use client'

/**
 * /publications
 *
 * PubMed-fed (Europe PMC) ciliopathy publications. Each record may carry an
 * AI summary that is generated once at ingest time and stored in the data
 * file — this page only reads the stored summary, it never calls an LLM.
 *
 * Data: /data/publications.json, refreshed by the weekly ingestion job
 * (.github/workflows/publications-ingest.yml).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Loader2, ExternalLink, Search, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react'
import { loadPublications, type Publication } from '@/lib/publicationsData'

const PAGE_SIZE = 20

export default function PublicationsPage() {
  return (
    <ErrorBoundary scope="publications">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [pubs, setPubs] = useState<Publication[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadPublications()
      .then((data) => {
        // Newest first (date is an ISO-ish string; empty sorts last).
        const sorted = [...data].sort((a, b) =>
          String(b.date ?? '').localeCompare(String(a.date ?? '')),
        )
        setPubs(sorted)
      })
      .catch((e) => setErr(e.message ?? String(e)))
  }, [])

  const filtered = useMemo(() => {
    if (!pubs) return []
    const q = query.trim().toLowerCase()
    if (!q) return pubs
    return pubs.filter((p) => {
      const hay = [
        p.title,
        p.ai_summary,
        p.journal,
        p.authors,
        ...(p.genes ?? []),
        ...(p.diseases ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [pubs, query])

  // The "New" badge marks the most recent ingest batch. We only flag it once
  // there is more than one distinct batch, so the initial seed isn't all "New".
  const newBatchDate = useMemo(() => {
    if (!pubs) return null
    const dates = pubs.map((p) => p.first_seen).filter(Boolean) as string[]
    if (dates.length === 0) return null
    let max = dates[0]
    let min = dates[0]
    for (const d of dates) {
      if (d > max) max = d
      if (d < min) min = d
    }
    return max !== min ? max : null
  }, [pubs])

  const newCount = useMemo(
    () => (newBatchDate && pubs ? pubs.filter((p) => p.first_seen === newBatchDate).length : 0),
    [pubs, newBatchDate],
  )

  // Reset to the first page whenever the filter changes.
  useEffect(() => {
    setPage(1)
  }, [query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  function goTo(p: number) {
    setPage(Math.min(Math.max(1, p), totalPages))
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header ref={topRef} className="mb-6 scroll-mt-24">
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Publications</h1>
          <p className="text-sm text-stone-500 mt-1 max-w-2xl">
            Ciliopathy literature from Europe PMC, refreshed weekly. AI summaries are generated
            once at ingest; new articles are summarized as they arrive.
          </p>
        </header>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, summary, journal, gene…"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-800/20 focus:border-red-800"
          />
        </div>

        {/* States */}
        {err && (
          <div className="bg-red-50/60 border-l-2 border-red-800 px-4 py-3 rounded-r text-sm text-stone-700">
            Could not load publications: {err}
          </div>
        )}

        {!pubs && !err && (
          <div className="flex items-center gap-2 text-sm text-stone-500 py-10 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading publications…
          </div>
        )}

        {pubs && !err && pubs.length === 0 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center text-sm text-stone-500">
            No publications yet. The weekly ingestion job will populate this section.
          </div>
        )}

        {pubs && !err && pubs.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 inline-flex items-center gap-2">
                <span>
                  {filtered.length.toLocaleString()}{' '}
                  {filtered.length === 1 ? 'article' : 'articles'}
                  {query && ' matching'}
                </span>
                {newCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 normal-case tracking-normal">
                    {newCount.toLocaleString()} new this week
                  </span>
                )}
              </p>
              <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
                Page {current} of {totalPages.toLocaleString()}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center text-sm text-stone-500">
                No articles match “{query}”.
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {shown.map((p) => (
                    <PublicationCard
                      key={p.pmid}
                      pub={p}
                      isNew={!!newBatchDate && p.first_seen === newBatchDate}
                    />
                  ))}
                </div>

                <Pagination current={current} totalPages={totalPages} onGo={goTo} />
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}

function PublicationCard({ pub, isNew }: { pub: Publication; isNew?: boolean }) {
  const meta = [pub.journal, pub.date].filter(Boolean).join(' · ')

  return (
    <article
      className={`bg-white rounded-lg border shadow-sm p-5 ${
        isNew ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-stone-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <a
          href={pub.source_link}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-start gap-1.5 text-stone-900 hover:text-red-800 transition"
        >
          <h2 className="text-base font-bold leading-snug tracking-tight">
            {pub.title || 'Untitled'}
          </h2>
          <ExternalLink className="w-3.5 h-3.5 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </a>
        {isNew && (
          <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold uppercase tracking-wide">
            New
          </span>
        )}
      </div>

      {pub.authors && (
        <p className="text-xs text-stone-500 mt-1 line-clamp-1">{pub.authors}</p>
      )}
      {meta && <p className="text-[12px] text-stone-400 mt-0.5">{meta}</p>}

      {pub.ai_summary && (
        <div className="mt-3 bg-stone-50 border border-stone-100 rounded-md p-3">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-1 inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> AI summary
          </p>
          <p className="text-[14px] text-stone-700 whitespace-pre-line leading-relaxed">
            {pub.ai_summary}
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {(pub.genes ?? []).slice(0, 6).map((g) => (
          <span
            key={`gene-${g}`}
            className="px-2 py-0.5 bg-red-50 text-red-800 border border-red-100 rounded text-[12px] font-semibold"
          >
            {g}
          </span>
        ))}
        {(pub.diseases ?? []).slice(0, 5).map((d) => (
          <span
            key={`disease-${d}`}
            className="px-2 py-0.5 bg-stone-50 text-stone-600 border border-stone-200 rounded text-[12px] font-medium"
          >
            {d}
          </span>
        ))}
        {(pub.genes?.length ?? 0) + (pub.diseases?.length ?? 0) > 11 && (
          <span className="text-[11px] text-stone-400">
            +{(pub.genes?.length ?? 0) + (pub.diseases?.length ?? 0) - 11} more
          </span>
        )}
        <a
          href={pub.source_link}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-[11px] text-stone-400 hover:text-red-800 tabular-nums transition"
        >
          PMID: {pub.pmid}
        </a>
      </div>
    </article>
  )
}

/** First/Prev + a windowed set of page numbers + Next/Last. */
function Pagination({
  current,
  totalPages,
  onGo,
}: {
  current: number
  totalPages: number
  onGo: (p: number) => void
}) {
  if (totalPages <= 1) return null

  const pages: (number | 'gap')[] = []
  const push = (p: number) => pages.push(p)
  const window = 1 // pages on each side of current
  const from = Math.max(2, current - window)
  const to = Math.min(totalPages - 1, current + window)

  push(1)
  if (from > 2) pages.push('gap')
  for (let p = from; p <= to; p++) push(p)
  if (to < totalPages - 1) pages.push('gap')
  if (totalPages > 1) push(totalPages)

  const btn =
    'min-w-[2rem] h-8 px-2 inline-flex items-center justify-center rounded text-xs font-semibold border transition'
  const idle = 'bg-white border-stone-200 text-stone-600 hover:border-red-800 hover:text-red-800'
  const active = 'bg-red-800 border-red-800 text-white'
  const disabled = 'opacity-40 cursor-not-allowed bg-white border-stone-200 text-stone-400'

  return (
    <nav className="mt-6 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      <button
        onClick={() => onGo(current - 1)}
        disabled={current === 1}
        className={`${btn} ${current === 1 ? disabled : idle}`}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {pages.map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-stone-400 text-xs select-none">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onGo(p)}
            className={`${btn} ${p === current ? active : idle}`}
            aria-current={p === current ? 'page' : undefined}
          >
            {p.toLocaleString()}
          </button>
        ),
      )}

      <button
        onClick={() => onGo(current + 1)}
        disabled={current === totalPages}
        className={`${btn} ${current === totalPages ? disabled : idle}`}
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  )
}
