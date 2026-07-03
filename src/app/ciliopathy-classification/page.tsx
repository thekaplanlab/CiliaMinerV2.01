'use client'

/**
 * Disease classification — sidebar layout, refined.
 *
 *   LEFT  — sticky sidebar (independent scroll): filter input,
 *           accordion of 4 ciliopathy classes with tinted headers,
 *           clickable disease rows underneath.
 *
 *   RIGHT — when no selection: a useful empty state with the class
 *           breakdown pills + a few featured-disease cards.
 *           When a disease is selected: breadcrumb pathway, name,
 *           rationale banner (red-800 left rule), gene pill grid,
 *           and CTA to the full disease page.
 *
 * Template classes throughout (bg-white, border-stone-200, bg-stone-50,
 * bg-red-50, text-red-800).
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Search, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'

interface RawGene {
  gene: string
  ciliopathies?: string[]
  ciliopathy_classes?: string[]
  localization?: string[] | string | null
}
interface RawMaster {
  genes: Record<string, RawGene>
  disease_classifications?: Record<string, string>
  disease_rationale?: Record<string, string>
  diseases_by_class?: Record<string, string[]>
}

function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v.length > 0) return v.split(';').map((s) => s.trim()).filter(Boolean)
  return []
}

// ── Class ordering + short labels ─────────────────────────────────────
const CLASS_ORDER = [
  'Primary Ciliopathies',
  'Tissue-restricted Ciliopathies',
  'Motile Ciliopathies',
  'Secondary Diseases',
]
const CLASS_LABEL: Record<string, string> = {
  'Primary Ciliopathies':           'Primary Ciliopathies',
  'Tissue-restricted Ciliopathies': 'Tissue-restricted',
  'Motile Ciliopathies':            'Motile Ciliopathies',
  'Secondary Diseases':             'Secondary Diseases',
}

// Featured diseases for the empty state — well-known ciliopathies
const FEATURED = [
  { name: 'Bardet-Biedl Syndrome',   tagline: 'Multi-system; BBSome trafficking defect' },
  { name: 'Joubert Syndrome',        tagline: 'Molar tooth sign; cerebellum + retina + kidney' },
  { name: 'Meckel-Gruber Syndrome',  tagline: 'Encephalocele + cystic kidneys + polydactyly' },
]

export default function ClassificationPage() {
  return (
    <ErrorBoundary scope="classification">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [master, setMaster] = useState<RawMaster | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/ciliopathy_genes_v15.json', { cache: 'default' })
      .then((r) => r.json())
      .then((d: RawMaster) => { if (!cancelled) setMaster(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // ── Grouped class lists ──────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!master) return [] as Array<{ cls: string; diseases: string[] }>
    const dbc = master.diseases_by_class || {}
    const out: Array<{ cls: string; diseases: string[] }> = []
    for (const cls of CLASS_ORDER) {
      const list = (dbc[cls] || []).slice().sort()
      if (list.length > 0) out.push({ cls, diseases: list })
    }
    // Catch any extras not in canonical order
    for (const cls of Object.keys(dbc)) {
      if (CLASS_ORDER.indexOf(cls) >= 0) continue
      const list = (dbc[cls] || []).slice().sort()
      if (list.length > 0) out.push({ cls, diseases: list })
    }
    return out
  }, [master])

  // Genes for each disease
  const genesByDisease = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!master) return map
    Array.from(Object.values(master.genes)).forEach((g) => {
      arr(g.ciliopathies).forEach((d) => {
        const list = map.get(d) || []
        list.push(g.gene)
        map.set(d, list)
      })
    })
    return map
  }, [master])

  // ── Filtering ────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase()
  const filteredGroups = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => ({
        cls: g.cls,
        diseases: g.diseases.filter((d) => d.toLowerCase().includes(q)),
      }))
      .filter((g) => g.diseases.length > 0)
  }, [groups, q])

  // When filtering, auto-expand all matching groups
  useEffect(() => {
    if (q) {
      const expanded: Record<string, boolean> = {}
      filteredGroups.forEach((g) => { expanded[g.cls] = true })
      setOpen(expanded)
    }
  }, [q, filteredGroups])

  // ── Counts ───────────────────────────────────────────────────────────
  const classCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    groups.forEach((g) => { counts[g.cls] = g.diseases.length })
    return counts
  }, [groups])
  const totalDiseases = groups.reduce((n, g) => n + g.diseases.length, 0)
  const visibleDiseases = filteredGroups.reduce((n, g) => n + g.diseases.length, 0)

  // ── Selected ─────────────────────────────────────────────────────────
  const selectedClass = selected
    ? (master?.disease_classifications?.[selected] || '')
    : ''
  const selectedRationale = selected
    ? (master?.disease_rationale?.[selected] || '')
    : ''
  const selectedGenes = selected ? (genesByDisease.get(selected) || []) : []

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-red-800 tracking-tight">
          Disease Classification
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          {master ? `${totalDiseases} diseases across ${groups.length} ciliopathy classes` : 'Loading…'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-4 items-start">
        {/* ── Sidebar (sticky on desktop) ──────────────────────────── */}
        <aside className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:flex md:flex-col">
          {/* Filter */}
          <div className="p-3 border-b border-stone-200 shrink-0">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter diseases…"
                aria-label="Filter diseases"
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition text-stone-900 font-medium placeholder:font-normal placeholder:text-stone-400"
              />
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5 pointer-events-none" aria-hidden="true" />
            </div>
            {q && (
              <p className="text-[11px] text-stone-400 mt-1.5 font-mono">
                {visibleDiseases} match
              </p>
            )}
          </div>

          {/* Groups list — independent scroll */}
          <div className="overflow-y-auto md:flex-1">
            {!master && (
              <p className="text-xs text-stone-400 italic px-3 py-4">Loading…</p>
            )}
            {master && filteredGroups.length === 0 && (
              <p className="text-xs text-stone-400 italic px-3 py-4">No matches.</p>
            )}
            {filteredGroups.map((g) => {
              const isOpen = !!open[g.cls]
              return (
                <div key={g.cls} className="border-b border-stone-200 last:border-b-0">
                  {/* Accordion header — tinted to differentiate from disease rows */}
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [g.cls]: !o[g.cls] }))}
                    aria-expanded={isOpen}
                    className={`w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left transition ${
                      isOpen
                        ? 'bg-stone-100 hover:bg-stone-100'
                        : 'bg-stone-50/60 hover:bg-stone-100'
                    }`}
                  >
                    <span className="flex items-baseline gap-2 min-w-0">
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" aria-hidden="true" />
                        : <ChevronRight className="w-3.5 h-3.5 text-stone-500 shrink-0" aria-hidden="true" />}
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-700 truncate">
                        {CLASS_LABEL[g.cls] || g.cls}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-stone-500 tabular-nums">
                      {g.diseases.length}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="bg-white pb-1">
                      {g.diseases.map((d) => {
                        const isSelected = selected === d
                        return (
                          <li key={d}>
                            <button
                              type="button"
                              onClick={() => setSelected(d)}
                              className={`w-full text-left px-3 py-1.5 pl-9 text-xs transition ${
                                isSelected
                                  ? 'bg-red-50 text-red-800 font-semibold border-l-2 border-red-800 pl-[34px]'
                                  : 'text-stone-700 hover:bg-stone-50 hover:text-stone-900'
                              }`}
                            >
                              {d}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Detail panel ───────────────────────────────────────── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 min-h-[60vh]">
          {!selected ? (
            <EmptyState
              classCounts={classCounts}
              total={totalDiseases}
              loading={!master}
              onPick={setSelected}
            />
          ) : (
            <div>
              {/* Breadcrumb pathway */}
              <nav className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3" aria-label="Breadcrumb">
                <Link href="/ciliopathy-classification" className="hover:text-stone-900 transition">
                  Disease Classification
                </Link>
                <span className="mx-1.5">›</span>
                <span className="text-red-800">
                  {CLASS_LABEL[selectedClass] || selectedClass || 'Disease'}
                </span>
                <span className="mx-1.5">›</span>
                <span className="text-stone-700 normal-case tracking-normal font-normal">
                  {selected}
                </span>
              </nav>

              {/* Title */}
              <h2 className="text-xl font-bold text-stone-900 tracking-tight leading-tight mb-5">
                {selected}
              </h2>

              {/* Rationale banner — tinted red-50 with left rule */}
              {selectedRationale && (
                <div className="bg-red-50/60 border-l-2 border-red-800 px-4 py-3 rounded-r mb-6">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-1.5">
                    Why this class
                  </p>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {selectedRationale}
                  </p>
                </div>
              )}

              {/* Genes — pill grid */}
              {selectedGenes.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
                      Associated genes
                    </p>
                    <p className="text-[11px] font-mono text-stone-400 tabular-nums">
                      {selectedGenes.length}
                    </p>
                  </div>
                  <ul className="flex flex-wrap gap-1.5">
                    {selectedGenes.slice(0, 80).map((gene) => (
                      <li key={gene}>
                        <Link
                          href={`/gene/${encodeURIComponent(gene)}`}
                          className="inline-block px-2.5 py-1 bg-stone-50 border border-stone-200 text-stone-700 rounded text-xs font-medium hover:border-red-800 hover:text-red-800 hover:bg-white transition"
                        >
                          {gene}
                        </Link>
                      </li>
                    ))}
                    {selectedGenes.length > 80 && (
                      <li className="text-[12px] text-stone-400 italic px-2 py-1">
                        +{selectedGenes.length - 80} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* CTA */}
              <Link
                href={`/disease/${encodeURIComponent(selected)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-800 text-white text-xs font-semibold rounded hover:bg-red-900 transition"
              >
                <span>Open full disease page</span>
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState({
  classCounts, total, loading, onPick,
}: {
  classCounts: Record<string, number>
  total: number
  loading: boolean
  onPick: (d: string) => void
}) {
  return (
    <div className="py-2">
      <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
        Select a disease
      </p>
      <p className="text-sm text-stone-500 max-w-md leading-relaxed mb-6">
        Pick a disease from the left sidebar to see its class, rationale, and associated genes — or jump to one of the common ciliopathies below.
      </p>

      {/* Class breakdown — pill badges with counts */}
      <div className="mb-7">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
          Catalogue breakdown {total > 0 && <span className="text-stone-300 normal-case tracking-normal font-mono ml-1">· {total} diseases</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {loading
            ? <span className="text-xs text-stone-400 italic">Loading…</span>
            : CLASS_ORDER.map((cls) => {
                const n = classCounts[cls] || 0
                if (n === 0) return null
                return (
                  <div
                    key={cls}
                    className="inline-flex items-baseline gap-2 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded"
                  >
                    <span className="text-base font-bold text-stone-900 tabular-nums">{n}</span>
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-stone-600">
                      {CLASS_LABEL[cls] || cls}
                    </span>
                  </div>
                )
              })}
        </div>
      </div>

      {/* Featured diseases */}
      <div>
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
          Common ciliopathies
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FEATURED.map((f) => (
            <button
              key={f.name}
              type="button"
              onClick={() => onPick(f.name)}
              className="text-left bg-stone-50 hover:bg-white border border-stone-200 hover:border-red-800 rounded p-3 transition group"
            >
              <p className="text-xs font-semibold text-stone-900 group-hover:text-red-800 transition mb-1">
                {f.name}
              </p>
              <p className="text-[12px] text-stone-500 leading-snug">
                {f.tagline}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
