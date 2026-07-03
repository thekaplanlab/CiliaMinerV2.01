'use client'

/**
 * Home page — matches design_ciliaminer.html template exactly.
 *
 *   • Search card        — bg-white card with a stone-50 input and a
 *                          row of "Quick view" filter chips. Search has
 *                          working autocomplete sourced from the gene
 *                          and disease catalogue.
 *   • Gene data table    — bg-white card with stone-50 header row,
 *                          divide-stone-200 rows, hover state, and a
 *                          pagination footer.
 *
 * Live search filter and class filter both apply to the table.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { downloadCSV, downloadJSON } from '@/lib/utils'
import { Search, Download } from 'lucide-react'

// ── Data shape ─────────────────────────────────────────────────────────

interface RawGene {
  gene: string
  ciliopathies?: string[]
  ciliopathy_classes?: string[]
  localization?: string[] | string | null
  functional_category?: string[] | string | null
  synonyms?: string[] | string | null
  description?: string
}

interface RawMaster {
  genes: Record<string, RawGene>
  diseases_by_class?: Record<string, string[]>
}

// Defensive coercion — v15 has occasional missing/string fields where
// arrays are expected (e.g. localization can be null, functional_category
// can be ""). Anything not-an-array-of-strings becomes [].
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v.length > 0) return v.split(';').map((s) => s.trim()).filter(Boolean)
  return []
}

const CLASS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all',                              label: 'All Data' },
  { id: 'Primary Ciliopathies',             label: 'Primary' },
  { id: 'Secondary Diseases',               label: 'Secondary' },
  { id: 'Motile Ciliopathies',              label: 'Motile' },
  { id: 'Tissue-restricted Ciliopathies',   label: 'Tissue-restricted' },
]

const PAGE_SIZE = 20

// ── Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <ErrorBoundary scope="home">
      <HomeInner />
    </ErrorBoundary>
  )
}

function HomeInner() {
  const router = useRouter()
  const [master, setMaster] = useState<RawMaster | null>(null)
  const [query, setQuery] = useState('')
  const [classId, setClassId] = useState('all')
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Load master JSON once ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetch('/data/ciliopathy_genes_v15.json', { cache: 'default' })
      .then((r) => r.json())
      .then((d: RawMaster) => { if (!cancelled) setMaster(d) })
      .catch(() => { /* table just stays empty */ })
    return () => { cancelled = true }
  }, [])

  // ── Source rows ──────────────────────────────────────────────────────
  const allRows = useMemo(() => {
    if (!master) return []
    return Object.values(master.genes).map((g) => ({
      symbol:        g.gene || '',
      classes:       arr(g.ciliopathy_classes),
      localization:  arr(g.localization),
      diseases:      arr(g.ciliopathies),
      synonyms:      arr(g.synonyms),
    }))
  }, [master])

  // Class label for display (short, fits in table cell)
  function shortClass(cs: string[]): string {
    if (cs.length === 0) return ''
    const c = cs[0]
    if (c.startsWith('Primary'))   return 'Primary'
    if (c.startsWith('Secondary')) return 'Secondary'
    if (c.startsWith('Motile'))    return 'Motile'
    if (c.startsWith('Tissue'))    return 'Tissue'
    return c
  }

  // ── Filtering ────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      // Class filter
      if (classId !== 'all') {
        if (!r.classes.includes(classId)) return false
      }
      // Search filter — matches gene, disease, localization, synonym
      if (q) {
        const hay = [
          r.symbol,
          ...r.diseases,
          ...r.localization,
          ...r.synonyms,
        ].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allRows, classId, q])

  // Reset to page 0 whenever filters change
  useEffect(() => { setPage(0) }, [q, classId])

  // ── Pagination slice ─────────────────────────────────────────────────
  const total = filteredRows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const pageRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Download — exports every gene matching the current filters (not just
  //    the visible page) as a flat CSV or JSON file. ─────────────────────
  function downloadGenes(format: 'csv' | 'json') {
    if (filteredRows.length === 0) return
    const rows = filteredRows.map((r) => ({
      gene: r.symbol,
      category: r.classes.join('; '),
      subcellular_localization: r.localization.join('; '),
      associated_diseases: r.diseases.join('; '),
      synonyms: r.synonyms.join('; '),
    }))
    const stamp = new Date().toISOString().slice(0, 10)
    const filename = `ciliaminer_genes_${stamp}.${format}`
    if (format === 'csv') downloadCSV(rows, filename)
    else downloadJSON(rows, filename)
  }

  // ── Autocomplete suggestions ─────────────────────────────────────────
  type Suggestion = { kind: 'gene' | 'disease'; label: string }
  const suggestions = useMemo<Suggestion[]>(() => {
    if (q.length < 1 || !master) return []
    const seen = new Set<string>()
    const out: Suggestion[] = []

    // Prefix-match genes first (most predictable autocomplete behaviour)
    const prefix: Suggestion[] = []
    const contains: Suggestion[] = []
    for (const sym of Object.keys(master.genes)) {
      const lower = sym.toLowerCase()
      if (lower.startsWith(q)) prefix.push({ kind: 'gene', label: sym })
      else if (lower.includes(q)) contains.push({ kind: 'gene', label: sym })
    }
    prefix.sort((a, b) => a.label.length - b.label.length || a.label.localeCompare(b.label))
    for (const s of prefix) {
      if (!seen.has(s.label)) { out.push(s); seen.add(s.label) }
      if (out.length >= 5) break
    }
    if (out.length < 7) {
      for (const s of contains) {
        if (!seen.has(s.label)) { out.push(s); seen.add(s.label) }
        if (out.length >= 7) break
      }
    }

    // Then unique disease names
    const diseaseSet = new Set<string>()
    Array.from(Object.values(master.genes)).forEach((g) => {
      for (const d of arr(g.ciliopathies)) diseaseSet.add(d)
    })
    const diseases = Array.from(diseaseSet).filter((d) => d.toLowerCase().includes(q))
    diseases.sort((a, b) => a.length - b.length || a.localeCompare(b))
    for (const d of diseases.slice(0, 4)) {
      if (!seen.has(d)) { out.push({ kind: 'disease', label: d }); seen.add(d) }
      if (out.length >= 9) break
    }
    return out.slice(0, 9)
  }, [q, master])

  // ── Suggestion / keyboard navigation ────────────────────────────────
  function goSuggestion(s: Suggestion) {
    if (s.kind === 'gene')         router.push(`/gene/${encodeURIComponent(s.label)}`)
    else if (s.kind === 'disease') router.push(`/disease/${encodeURIComponent(s.label)}`)
  }
  function submit() {
    if (active >= 0 && suggestions[active]) { goSuggestion(suggestions[active]); return }
    // Otherwise: just keep the filter applied to the table; do nothing
    setOpen(false)
  }
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length === 0) return
      setOpen(true)
      setActive((i) => Math.min(suggestions.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(-1, i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false); setActive(-1)
    } else if (e.key === 'Enter') {
      submit()
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="flex flex-col justify-center min-h-[calc(100vh-220px)]">
        {/* ── Search and Quick View Controller ─────────────────────── */}
        <div className="bg-white p-4 rounded-lg border border-stone-200 shadow-sm mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder="Search by gene symbol, disease category, or clinical symptoms..."
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(-1) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={onKeyDown}
              aria-expanded={open && suggestions.length > 0}
              aria-controls="home-search-listbox"
              role="combobox"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition text-stone-900 font-medium"
            />
            <Search
              className="w-4 h-4 text-stone-400 absolute left-3.5 top-3.5 pointer-events-none"
              aria-hidden="true"
            />

            {/* Autocomplete dropdown */}
            {open && suggestions.length > 0 && (
              <ul
                id="home-search-listbox"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded shadow-md z-20 overflow-hidden"
              >
                {suggestions.map((s, i) => (
                  <li key={`${s.kind}-${s.label}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); goSuggestion(s) }}
                      onMouseEnter={() => setActive(i)}
                      className={`w-full px-3 py-2 flex items-baseline justify-between gap-3 text-left text-xs transition ${
                        i === active ? 'bg-stone-100 text-red-800' : 'text-stone-700 hover:bg-stone-50'
                      }`}
                    >
                      <span className="font-semibold flex-1 truncate">{s.label}</span>
                      <span className="text-[11px] uppercase tracking-wider text-stone-400 font-mono">
                        {s.kind}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick view filter chips */}
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-stone-100 text-xs font-semibold">
            <span className="text-stone-400 font-medium mr-1">Quick view:</span>
            {CLASS_FILTERS.map((f) => {
              const isActive = classId === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setClassId(f.id)}
                  className={
                    isActive
                      ? 'px-3 py-1 bg-red-800 text-white rounded'
                      : 'px-3 py-1 bg-stone-100 text-stone-600 rounded hover:bg-stone-200 transition'
                  }
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Data table ────────────────────────────────────────────── */}
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          {/* Toolbar — result count + download of the filtered gene set */}
          <div className="p-3 sm:px-4 border-b border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-stone-500">
              <span className="font-semibold text-stone-700">{total.toLocaleString()}</span>{' '}
              gene{total === 1 ? '' : 's'}
              {(q || classId !== 'all') && <span className="text-stone-400"> matching filter</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mr-0.5">
                Download
              </span>
              <button
                type="button"
                onClick={() => downloadGenes('csv')}
                disabled={total === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 text-xs font-semibold rounded transition"
                aria-label="Download filtered genes as CSV"
              >
                <Download className="w-3 h-3" aria-hidden="true" /> CSV
              </button>
              <button
                type="button"
                onClick={() => downloadGenes('json')}
                disabled={total === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-40 disabled:cursor-not-allowed text-stone-700 text-xs font-semibold rounded transition"
                aria-label="Download filtered genes as JSON"
              >
                <Download className="w-3 h-3" aria-hidden="true" /> JSON
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-xs font-bold uppercase tracking-wider text-stone-600">
                  <th className="py-3 px-6">Gene</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Subcellular Localization</th>
                  <th className="py-3 px-6 text-right">Associated Disease</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200 text-xs text-stone-700">
                {!master && (
                  <tr>
                    <td colSpan={4} className="py-10 px-6 text-center text-stone-400 font-mono">
                      Loading…
                    </td>
                  </tr>
                )}
                {master && pageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 px-6 text-center text-stone-400">
                      No genes match the current filters.
                    </td>
                  </tr>
                )}
                {pageRows.map((r) => (
                  <tr key={r.symbol} className="hover:bg-stone-50/50 transition">
                    <td className="py-3.5 px-6 font-semibold text-stone-900">
                      <Link
                        href={`/gene/${encodeURIComponent(r.symbol)}`}
                        className="hover:text-red-800 transition"
                      >
                        {r.symbol}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">{shortClass(r.classes)}</td>
                    <td className="py-3.5 px-4 text-stone-500">
                      {r.localization.slice(0, 2).join(', ')}
                    </td>
                    <td className="py-3.5 px-6 text-right text-stone-600">
                      {r.diseases[0] ? (
                        <Link
                          href={`/disease/${encodeURIComponent(r.diseases[0])}`}
                          className="hover:text-red-800 transition"
                        >
                          {r.diseases[0]}
                        </Link>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="p-4 border-t border-stone-200 bg-stone-50/50 flex items-center justify-between text-xs text-stone-500">
            <div>
              {total === 0
                ? 'No items'
                : `Showing ${page * PAGE_SIZE + 1}-${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} items`}
            </div>
            <div className="flex space-x-1">
              <PageButtons page={page} totalPages={totalPages} onChange={setPage} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ── Pagination buttons ────────────────────────────────────────────────

function PageButtons({
  page, totalPages, onChange,
}: {
  page: number
  totalPages: number
  onChange: (p: number) => void
}) {
  // Show up to 5 page buttons: 1, current-1, current, current+1, last
  // with ellipses where there are gaps.
  if (totalPages <= 1) {
    return (
      <button
        type="button"
        className="px-2 py-1 bg-white border border-stone-200 rounded text-stone-700 font-bold"
      >
        1
      </button>
    )
  }

  const pages: number[] = []
  pages.push(0)
  if (page - 1 > 0) pages.push(page - 1)
  if (page !== 0 && page !== totalPages - 1) pages.push(page)
  if (page + 1 < totalPages - 1) pages.push(page + 1)
  if (totalPages - 1 !== 0) pages.push(totalPages - 1)

  const unique = Array.from(new Set(pages)).sort((a, b) => a - b)

  const elems: React.ReactNode[] = []
  let prev = -2
  for (const p of unique) {
    if (prev >= 0 && p - prev > 1) {
      elems.push(
        <span key={`gap-${p}`} className="px-1 py-1 text-stone-400">…</span>,
      )
    }
    const isCur = p === page
    elems.push(
      <button
        key={p}
        type="button"
        onClick={() => onChange(p)}
        className={
          isCur
            ? 'px-2 py-1 bg-white border border-stone-200 rounded text-stone-700 font-bold'
            : 'px-2 py-1 bg-white border border-stone-200 rounded text-stone-500 hover:bg-stone-100 transition'
        }
      >
        {p + 1}
      </button>,
    )
    prev = p
  }
  return <>{elems}</>
}
