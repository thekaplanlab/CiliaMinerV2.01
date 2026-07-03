'use client'

/**
 * /compare-diseases
 *
 * Side-by-side comparison of symptom profiles across 2 to 4 ciliopathies.
 * Users pick diseases from a typeahead; the page renders:
 *   • a set-based summary (union, all-shared, unique-per-disease)
 *   • a filterable concept matrix grouped by organ system
 *   • CSV export
 *
 * Self-contained: loads clinical_features_v1.json directly.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Copy, Download, Loader2, X, Search } from 'lucide-react'
import {
  loadClinical, compare, listAvailableDiseases, comparisonToCsv,
  type ClinicalFile, type Comparison,
} from '@/lib/diseaseComparison'

const MAX_SELECT = 4
const MIN_TO_COMPARE = 2

/** Suggestion sets — one click loads a well-known clinical comparison */
const PRESETS: Array<{ label: string; diseases: string[] }> = [
  { label: 'BBS vs Alström vs Senior-Løken',
    diseases: ['Bardet-Biedl Syndrome', 'Alström Syndrome', 'Senior-Løken Syndrome'] },
  { label: 'Joubert vs Meckel-Gruber vs Orofaciodigital',
    diseases: ['Joubert Syndrome', 'Meckel-Gruber Syndrome', 'Orofaciodigital Syndrome'] },
  { label: 'BBS vs Joubert vs Meckel-Gruber vs PCD',
    diseases: ['Bardet-Biedl Syndrome', 'Joubert Syndrome', 'Meckel-Gruber Syndrome', 'Primary Ciliary Dyskinesia'] },
  { label: 'IFT vs BBSome ciliopathies',
    diseases: ['Short-Rib Thoracic Dysplasia', 'Cranioectodermal Dysplasia (Sensenbrenner)', 'Bardet-Biedl Syndrome'] },
]

export default function CompareDiseasesPage() {
  return (
    <ErrorBoundary scope="compare-diseases">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [clinical, setClinical] = useState<ClinicalFile | null>(null)
  const [err,      setErr]      = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [search,   setSearch]   = useState('')

  useEffect(() => {
    let cancelled = false
    loadClinical()
      .then((c) => { if (!cancelled) setClinical(c) })
      .catch((e) => { if (!cancelled) setErr((e as Error)?.message ?? 'load failed') })
    return () => { cancelled = true }
  }, [])

  const allDiseases = useMemo(() => (clinical ? listAvailableDiseases(clinical) : []), [clinical])

  // Typeahead-filtered candidate list
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return [] as string[]
    return allDiseases
      .filter((d) => !selected.includes(d) && d.toLowerCase().includes(q))
      .slice(0, 10)
  }, [allDiseases, selected, search])

  // Compare when >= 2 diseases picked and data is loaded
  const comparison: Comparison | null = useMemo(() => {
    if (!clinical || selected.length < MIN_TO_COMPARE) return null
    return compare(selected, clinical)
  }, [clinical, selected])

  function add(d: string) {
    if (selected.includes(d) || selected.length >= MAX_SELECT) return
    setSelected([...selected, d])
    setSearch('')
  }
  function remove(d: string) {
    setSelected(selected.filter((x) => x !== d))
  }
  function loadPreset(diseases: string[]) {
    setSelected(diseases.slice(0, MAX_SELECT))
    setSearch('')
  }
  function clearAll() {
    setSelected([])
    setSearch('')
  }

  return (
    <Layout>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-lg font-bold text-red-800 tracking-tight">Compare diseases</h1>
          <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            symptom overlap
          </span>
        </div>
        <p className="text-xs text-stone-600 mt-1 max-w-2xl">
          Pick 2–{MAX_SELECT} ciliopathies. CiliaMiner reports which HPO-coded concepts are
          shared across all of them, which are shared by some, and which are unique to each.
          Useful for differential diagnosis, understanding overlap syndromes, and figure prep.
        </p>
      </div>

      {err && (
        <div className="bg-red-50/60 border-l-2 border-red-800 px-4 py-3 rounded-r mb-4">
          <p className="text-xs text-red-800">{err}</p>
        </div>
      )}

      {/* ── Picker ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-2 gap-3 flex-wrap">
          <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
            Selected diseases ({selected.length}/{MAX_SELECT})
          </p>
          {selected.length === 0 && clinical && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-stone-400 mr-1">Try:</span>
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => loadPreset(p.diseases)}
                  className="text-[11px] font-medium text-red-800 hover:text-red-900 underline-offset-2 hover:underline"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-stone-400 hover:text-stone-700 transition"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Chips for currently selected diseases */}
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 mb-3">
            {selected.map((d) => (
              <li key={d}>
                <span className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-red-50 border border-red-200 rounded text-[12px] font-medium text-red-800">
                  {d}
                  <button
                    type="button"
                    onClick={() => remove(d)}
                    className="hover:bg-red-100 rounded p-0.5 transition"
                    aria-label={`Remove ${d}`}
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Search input for adding more */}
        {selected.length < MAX_SELECT && (
          <div className="relative">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-[9px] pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={clinical
                ? `Search from ${allDiseases.length} diseases with curated symptom data…`
                : 'Loading…'}
              disabled={!clinical}
              className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition"
              aria-label="Search diseases"
            />
            {candidates.length > 0 && (
              <ul className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded shadow-lg max-h-64 overflow-y-auto [scrollbar-gutter:stable]">
                {candidates.map((d) => (
                  <li key={d}>
                    <button
                      type="button"
                      onClick={() => add(d)}
                      className="w-full text-left px-3 py-2 text-xs text-stone-700 hover:bg-red-50 hover:text-red-800 transition"
                    >
                      {d}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {selected.length === MAX_SELECT && (
          <p className="text-[11px] text-stone-400 italic">
            Maximum of {MAX_SELECT} diseases per comparison. Remove one to add another.
          </p>
        )}
        {selected.length === 1 && (
          <p className="text-[12px] text-stone-500 mt-2">
            Pick at least one more disease to see the comparison.
          </p>
        )}
      </div>

      {/* ── Results ────────────────────────────────────────────────── */}
      {!clinical && !err ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-8 text-center">
          <p className="text-xs text-stone-400 inline-flex items-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            Loading curated symptom data…
          </p>
        </div>
      ) : comparison ? (
        <ComparisonBlock comparison={comparison} />
      ) : null}

      {/* ── About ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mt-4">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
          About this comparison
        </p>
        <p className="text-xs text-stone-700 leading-relaxed">
          Diseases are compared on canonicalised HPO-coded concept sets derived from OMIM
          clinical synopses (76 diseases with curated symptom data of the 104 in the full
          catalogue). Presence is boolean per disease — the OMIM-derived data doesn&rsquo;t
          resolve frequency information (&ldquo;polydactyly present in 40 % of patients&rdquo;),
          so this tool reports whether a manifestation has been reported for a disease, not
          how often it occurs.
        </p>
      </div>
    </Layout>
  )
}

// ── Results block ────────────────────────────────────────────────────

type FilterMode =
  | { kind: 'all' }
  | { kind: 'shared_all' }
  | { kind: 'shared_2plus' }
  | { kind: 'unique_to'; disease: string }

function ComparisonBlock({ comparison }: { comparison: Comparison }) {
  const [filter, setFilter] = useState<FilterMode>({ kind: 'all' })
  const [copied, setCopied] = useState(false)

  // Apply filter
  const filteredRows = useMemo(() => {
    if (filter.kind === 'all') return comparison.rows
    if (filter.kind === 'shared_all') {
      return comparison.rows.filter((r) => r.present_count === comparison.selected.length)
    }
    if (filter.kind === 'shared_2plus') {
      return comparison.rows.filter((r) => r.present_count >= 2)
    }
    // unique_to
    const idx = comparison.selected.indexOf(filter.disease)
    return comparison.rows.filter(
      (r) => r.present_count === 1 && r.presence[idx],
    )
  }, [comparison, filter])

  // Group filtered rows by organ
  const byOrgan = useMemo(() => {
    const m = new Map<string, typeof filteredRows>()
    filteredRows.forEach((r) => {
      const list = m.get(r.organ) || []
      list.push(r)
      m.set(r.organ, list)
    })
    return Array.from(m.entries()).sort((a, b) =>
      b[1].length - a[1].length || a[0].localeCompare(b[0]),
    )
  }, [filteredRows])

  function copyConcepts() {
    if (!filteredRows.length) return
    const text = filteredRows.map((r) => r.concept).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  function downloadCsv() {
    const csv = comparisonToCsv(comparison)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `ciliaminer_comparison_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <>
      {/* ── Set-based summary ─────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5 mb-4">
        <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
          <p className="text-[11px] uppercase tracking-wider font-bold text-red-800">
            Overlap summary
          </p>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[12px] font-semibold text-stone-700"
          >
            <Download className="w-3 h-3" aria-hidden="true" />
            <span>CSV</span>
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <SummaryStat label="Union (any disease)" value={comparison.total_concepts} />
          <SummaryStat label={`Shared by all ${comparison.selected.length}`} value={comparison.shared_by_all_count} accent />
          <SummaryStat label="Shared by ≥ 2" value={comparison.shared_by_at_least_2} />
          <SummaryStat
            label="Unique concepts"
            value={Object.values(comparison.unique_by_disease).reduce((s, n) => s + n, 0)}
          />
        </div>
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mb-2">
          Concepts unique to each disease
        </p>
        <ul className="space-y-1">
          {comparison.selected.map((d) => (
            <li key={d} className="flex items-baseline justify-between text-xs">
              <Link
                href={`/disease/${encodeURIComponent(d)}`}
                className="text-stone-700 hover:text-red-800 transition truncate min-w-0"
              >
                {d}
              </Link>
              <span className="font-mono tabular-nums text-stone-500 shrink-0 ml-2">
                {comparison.unique_by_disease[d] || 0}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Filter bar ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-4 mb-4">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
          Filter
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <FilterChip active={filter.kind === 'all'} onClick={() => setFilter({ kind: 'all' })}>
            All ({comparison.total_concepts})
          </FilterChip>
          <FilterChip active={filter.kind === 'shared_all'} onClick={() => setFilter({ kind: 'shared_all' })}>
            Shared by all {comparison.selected.length} ({comparison.shared_by_all_count})
          </FilterChip>
          <FilterChip active={filter.kind === 'shared_2plus'} onClick={() => setFilter({ kind: 'shared_2plus' })}>
            Shared by ≥ 2 ({comparison.shared_by_at_least_2})
          </FilterChip>
          {comparison.selected.map((d) => (
            <FilterChip
              key={d}
              active={filter.kind === 'unique_to' && filter.disease === d}
              onClick={() => setFilter({ kind: 'unique_to', disease: d })}
            >
              Unique to {shortName(d)} ({comparison.unique_by_disease[d] || 0})
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Concept matrix ─────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-5">
        <div className="flex items-baseline justify-between mb-3 gap-2 flex-wrap">
          <p className="text-[11px] uppercase tracking-wider font-bold text-red-800">
            Concept matrix
          </p>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-stone-400 tabular-nums">
              {filteredRows.length} concept{filteredRows.length === 1 ? '' : 's'}
            </span>
            {filteredRows.length > 0 && (
              <button
                type="button"
                onClick={copyConcepts}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 hover:text-red-800 transition rounded text-[11px] font-semibold text-stone-700"
              >
                <Copy className="w-3 h-3" aria-hidden="true" />
                <span>{copied ? 'Copied' : 'Copy names'}</span>
              </button>
            )}
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <p className="text-xs text-stone-500 italic">No concepts match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-stone-200">
                  <th className="text-left py-2 pr-3 text-[11px] uppercase tracking-wider font-bold text-stone-500 sticky left-0 bg-white">
                    Concept
                  </th>
                  {comparison.selected.map((d) => (
                    <th
                      key={d}
                      className="text-center py-2 px-2 text-[11px] uppercase tracking-wider font-bold text-stone-500 whitespace-nowrap"
                      title={d}
                    >
                      {shortName(d)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byOrgan.map(([organ, rows]) => (
                  <React.Fragment key={organ}>
                    <tr>
                      <td colSpan={1 + comparison.selected.length} className="pt-4 pb-1">
                        <span className="text-[11px] uppercase tracking-wider font-bold text-red-800">
                          {organ.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[11px] font-mono text-stone-400 ml-2 tabular-nums">
                          {rows.length}
                        </span>
                      </td>
                    </tr>
                    {rows.map((r) => (
                      <tr key={r.concept} className="border-b border-stone-100 hover:bg-stone-50/50 transition">
                        <td className="py-1.5 pr-3 min-w-[16rem]">
                          <Link
                            href={`/symptoms-diseases#concept=${encodeURIComponent(r.concept)}`}
                            className="text-stone-800 hover:text-red-800 transition"
                          >
                            {r.concept}
                          </Link>
                          {r.hpo_id && (
                            <span className="text-[11px] font-mono text-stone-400 ml-2">
                              {r.hpo_id}
                            </span>
                          )}
                        </td>
                        {r.presence.map((p, i) => (
                          <td key={i} className="text-center py-1.5 px-2">
                            {p ? (
                              <span className="inline-block w-2 h-2 rounded-full bg-red-800" aria-label="present" />
                            ) : (
                              <span className="inline-block w-2 h-2 rounded-full bg-stone-200" aria-label="absent" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ── UI subcomponents ─────────────────────────────────────────────────

function SummaryStat({
  label, value, accent,
}: {
  label: string; value: number; accent?: boolean
}) {
  return (
    <div className={`p-3 rounded ${accent ? 'bg-red-50 border border-red-200' : 'bg-stone-50 border border-stone-200'}`}>
      <div className={`text-xl font-bold tabular-nums leading-none ${accent ? 'text-red-800' : 'text-stone-900'}`}>
        {value.toLocaleString()}
      </div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mt-1.5">
        {label}
      </div>
    </div>
  )
}

function FilterChip({
  active, onClick, children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-medium px-2.5 py-1 rounded border transition ${
        active
          ? 'bg-red-800 text-white border-red-800'
          : 'bg-white text-stone-700 border-stone-200 hover:border-red-800 hover:text-red-800'
      }`}
    >
      {children}
    </button>
  )
}

/** Compact display name for column headers — keeps the matrix scannable. */
function shortName(d: string): string {
  // Trim common trailing "Syndrome" for header brevity, keep it as tooltip
  return d
    .replace(/\s+Syndrome$/i, '')
    .replace(/\s+\([^)]+\)\s*$/, '')      // strip parenthetical suffix
    .trim()
}
