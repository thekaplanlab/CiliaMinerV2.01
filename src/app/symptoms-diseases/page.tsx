'use client'

/**
 * Symptoms — sidebar layout with smart typeahead.
 *
 *   LEFT (sidebar)
 *     - Search input that does smart matching across:
 *         (a) 347 canonical HPO concepts
 *         (b) 4,580 folk-term synonyms
 *         (c) 6,282 raw OMIM clinical phrases
 *       When the user types free text like "extra fingers" or
 *       "no movement of cilia", we surface canonical concepts under a
 *       "Smart matches" panel above the catalogue, deduped by concept.
 *     - Collapsible organ-system groups for browsing.
 *
 *   RIGHT (detail)
 *     - HPO definition + synonyms for the selected concept.
 *     - Ranked table of diseases that exhibit it.
 *
 * URL-shareable: #concept=Polydactyly auto-opens that concept on load.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  loadSymptoms,
  type SymptomsFile,
  type SymptomConcept,
} from '@/lib/symptomsData'
import { loadHpo, type HpoTerm } from '@/lib/hpoData'
import { loadDiseasePmidIndex, normalizeDiseaseName } from '@/lib/publicationsData'
import {
  loadClinical,
  type ClinicalFile,
} from '@/lib/clinicalFeaturesData'
import { Search, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import { OrganIcon } from '@/components/OrganIcons'

interface PhraseEntry {
  text: string
  textLc: string
  concept: string
  /** 'concept' | 'synonym' | 'omim' — affects display label */
  source: 'concept' | 'synonym' | 'omim'
}

/**
 * Quick-pick example concepts shown on the empty state of the right panel,
 * so first-time visitors have something concrete to click rather than a
 * blank pane. Each must be a canonical concept name in the corpus.
 * `available` checks gate the buttons against the loaded catalogue so a
 * stale name never produces a dead click.
 */
const EXAMPLE_CONCEPTS: Array<{ name: string; hint: string }> = [
  { name: 'Molar tooth sign',                                 hint: 'CNS · Joubert Syndrome hallmark' },
  { name: 'Polydactyly',                                      hint: 'Skeletal · classic ciliopathy sign' },
  { name: 'Renal cysts / cystic kidney',                      hint: 'Renal · PKD, NPH, BBS, MKS' },
  { name: 'Retinal dystrophy (other / unspecified)',          hint: 'Eye · most multisystem ciliopathies' },
  { name: 'Situs inversus / heterotaxy (organ-level)',        hint: 'Cardiac · primary ciliary dyskinesia' },
  { name: 'Encephalocele',                                    hint: 'CNS · Meckel-Gruber hallmark' },
]

export default function SymptomsPage() {
  return (
    <ErrorBoundary scope="symptoms">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [data, setData] = useState<SymptomsFile | null>(null)
  const [hpo, setHpo] = useState<Record<string, HpoTerm> | null>(null)
  const [clinical, setClinical] = useState<ClinicalFile | null>(null)
  const [diseasePmids, setDiseasePmids] = useState<Record<string, string[]>>({})
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<string | null>(null)

  // Load symptoms + HPO defs + clinical (lazy — sidebar still works without it)
  useEffect(() => {
    let cancelled = false
    Promise.all([loadSymptoms(), loadHpo().catch(() => null)])
      .then(([d, h]) => {
        if (cancelled) return
        setData(d)
        setHpo(h?.terms ?? null)
      })
      .catch(() => {})
    // Clinical features (for OMIM-phrase matching) — heaviest, fetched separately
    loadClinical()
      .then((c) => { if (!cancelled) setClinical(c) })
      .catch(() => {})
    // Disease → PMID index (for the Reference ID column) — optional, non-blocking
    loadDiseasePmidIndex()
      .then((idx) => { if (!cancelled) setDiseasePmids(idx) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Hash sync
  useEffect(() => {
    if (typeof window === 'undefined') return
    const m = window.location.hash.match(/concept=([^&]+)/)
    if (m) {
      try { setSelected(decodeURIComponent(m[1])) } catch {}
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (selected) {
      const enc = encodeURIComponent(selected)
      if (window.location.hash !== `#concept=${enc}`) {
        history.replaceState(null, '', `#concept=${enc}`)
      }
    } else if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [selected])

  // No default selection — show the "SELECT A SYMPTOM" empty state on first
  // visit, matching the Disease Classification page's behaviour.

  // Group concepts by organ → parent_concept → [concept names].
  // Parents within an organ are ordered by descending concept count
  // (largest sub-groups first), then alphabetically.
  const groups = useMemo(() => {
    if (!data) return [] as Array<{
      organ: string
      total: number
      parents: Array<{ name: string; concepts: string[] }>
    }>
    type ParentMap = Record<string, string[]>
    const byOrgan: Record<string, ParentMap> = {}
    Object.entries(data.concepts).forEach(([name, c]) => {
      const organ  = (c && c.organ)          ? c.organ          : 'Other'
      const parent = (c && c.parent_concept) ? c.parent_concept : 'Other'
      if (!byOrgan[organ]) byOrgan[organ] = {}
      if (!byOrgan[organ][parent]) byOrgan[organ][parent] = []
      byOrgan[organ][parent].push(name)
    })
    return Object.keys(byOrgan)
      .sort()
      .map((organ) => {
        const parents = Object.keys(byOrgan[organ])
          .map((p) => ({ name: p, concepts: byOrgan[organ][p].slice().sort() }))
          .sort((a, b) => b.concepts.length - a.concepts.length || a.name.localeCompare(b.name))
        const total = parents.reduce((n, p) => n + p.concepts.length, 0)
        return { organ, total, parents }
      })
  }, [data])

  // Build the typeahead index
  // (concept names + synonyms always; OMIM phrases once clinical loads)
  const phraseIndex = useMemo<PhraseEntry[]>(() => {
    if (!data) return []
    const idx: PhraseEntry[] = []
    // 1) Canonical concepts
    Object.keys(data.concepts).forEach((name) => {
      idx.push({ text: name, textLc: name.toLowerCase(), concept: name, source: 'concept' })
    })
    // 2) Synonyms
    Object.entries(data.synonyms || {}).forEach(([alt, canonical]) => {
      if (data.concepts[canonical]) {
        idx.push({ text: alt, textLc: alt.toLowerCase(), concept: canonical, source: 'synonym' })
      }
    })
    // 3) OMIM raw phrases — once clinical features are available
    if (clinical) {
      Object.values(clinical.diseases || {}).forEach((d: any) => {
        Object.values(d.by_organ_records || {}).forEach((organConcepts: any) => {
          (organConcepts || []).forEach((c: any) => {
            const conceptName = c.concept
            if (!conceptName || !data.concepts[conceptName]) return
            ;(c.sources || []).forEach((s: any) => {
              if (s && typeof s.raw_phrase === 'string' && s.raw_phrase.length > 0) {
                const t = s.raw_phrase
                idx.push({ text: t, textLc: t.toLowerCase(), concept: conceptName, source: 'omim' })
              }
            })
          })
        })
      })
    }
    return idx
  }, [data, clinical])

  // Run the typeahead
  const q = query.trim().toLowerCase()
  const matches = useMemo<Array<{ concept: string; match: PhraseEntry; score: number }>>(() => {
    if (q.length < 2 || phraseIndex.length === 0) return []
    const scored: Array<{ concept: string; match: PhraseEntry; score: number }> = []
    // Score entries by match type and length penalty
    for (const e of phraseIndex) {
      const t = e.textLc
      let score = 0
      if (t === q) score = 100
      else if (t.startsWith(q)) score = 80 - Math.min(20, t.length - q.length)
      else if (
        // word-start match
        t.indexOf(' ' + q) >= 0 ||
        t.indexOf(',' + q) >= 0
      ) score = 60 - Math.min(15, t.length - q.length)
      else if (t.indexOf(q) >= 0) score = 40 - Math.min(15, t.length - q.length)
      else continue
      // Canonical concept wins ties against synonym/omim of same length
      if (e.source === 'concept') score += 3
      else if (e.source === 'synonym') score += 1
      scored.push({ concept: e.concept, match: e, score })
    }
    // Highest score first; dedupe by concept (keep best match)
    scored.sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    const out: Array<{ concept: string; match: PhraseEntry; score: number }> = []
    for (const item of scored) {
      if (seen.has(item.concept)) continue
      seen.add(item.concept)
      out.push(item)
      if (out.length >= 8) break
    }
    return out
  }, [q, phraseIndex])

  // Sidebar group filter — when the query matches a parent_concept name
  // (e.g. "Hearing loss"), the whole sub-group surfaces; otherwise it
  // filters within each parent by concept name.
  const filteredGroups = useMemo(() => {
    if (!q) return groups
    return groups
      .map((g) => {
        const parents = g.parents
          .map((p) => {
            const parentMatches = p.name.toLowerCase().includes(q)
            const conceptsKept = parentMatches
              ? p.concepts
              : p.concepts.filter((c) => c.toLowerCase().includes(q))
            return { name: p.name, concepts: conceptsKept }
          })
          .filter((p) => p.concepts.length > 0)
        const total = parents.reduce((n, p) => n + p.concepts.length, 0)
        return { organ: g.organ, total, parents }
      })
      .filter((g) => g.parents.length > 0)
  }, [groups, q])

  // When the user types a filter query, auto-expand every group that has
  // a match (so they can see what was found). On a clean load nothing
  // is expanded — they pick what they want to explore.
  useEffect(() => {
    if (q) {
      const expanded: Record<string, boolean> = {}
      filteredGroups.forEach((g) => { expanded[g.organ] = true })
      setOpen(expanded)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filteredGroups])

  const totalConcepts = groups.reduce((n, g) => n + g.total, 0)
  const visibleConcepts = filteredGroups.reduce((n, g) => n + g.total, 0)

  // Selected concept
  const concept: SymptomConcept | null = selected && data
    ? (data.concepts[selected] || lookupConceptByName(data, selected))
    : null
  const hpoIds = concept && Array.isArray(concept.hpo_ids)
    ? concept.hpo_ids.filter(Boolean)
    : []
  const primaryHpo = hpoIds[0]
  const term = primaryHpo && hpo ? hpo[primaryHpo] : null
  const diseases = concept && Array.isArray(concept.diseases)
    ? [...concept.diseases].sort((a, b) => (b.evidence_count || 0) - (a.evidence_count || 0))
    : []

  function pickMatch(conceptName: string) {
    setSelected(conceptName)
    setQuery('')
  }

  return (
    <Layout>
      <div className="mb-4">
        <h1 className="text-lg font-bold text-red-800 tracking-tight">Symptoms</h1>
        <p className="text-xs text-stone-600 mt-1">
          {data
            ? `${totalConcepts} canonical concepts across ${groups.length} organ systems` +
              (clinical ? ' · 6,282 OMIM phrases indexed' : ' · indexing OMIM phrases…')
            : 'Loading…'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-4">
        {/* ── Sidebar ────────────────────────────────────────────── */}
        <aside className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-3 border-b border-stone-200">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type any symptom — even free text"
                aria-label="Search symptoms"
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-red-800 focus:bg-white transition text-stone-900 font-medium placeholder:font-normal placeholder:text-stone-400"
              />
              <Search className="w-4 h-4 text-stone-500 absolute left-3 top-[9px] pointer-events-none" aria-hidden="true" />
            </div>
            {q && (
              <p className="text-[11px] text-stone-400 mt-1.5 font-mono">
                {matches.length} predicted · {visibleConcepts} catalogue
              </p>
            )}
          </div>

          {/* Smart-matches panel — appears only when query has matches */}
          {q && matches.length > 0 && (
            <div className="border-b border-stone-200 bg-stone-50/40">
              <div className="px-3 py-2 flex items-center gap-1.5">
                <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-red-800" />
                <span className="text-[11px] uppercase tracking-wider font-bold text-red-800">
                  Smart matches
                </span>
              </div>
              <ul>
                {matches.map((m, i) => {
                  const isSelected = selected === m.concept
                  const matchedText = m.match.text.length > 60
                    ? m.match.text.slice(0, 60) + '…'
                    : m.match.text
                  return (
                    <li key={`${m.concept}-${i}`}>
                      <button
                        type="button"
                        onClick={() => pickMatch(m.concept)}
                        className={`w-full text-left px-3 py-2 transition ${
                          isSelected ? 'bg-red-50' : 'hover:bg-white'
                        }`}
                      >
                        <div className="flex items-baseline gap-2">
                          <span className={`text-xs font-semibold truncate ${
                            isSelected ? 'text-red-800' : 'text-stone-900'
                          }`}>
                            {m.concept}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-mono text-stone-400 shrink-0">
                            {m.match.source}
                          </span>
                        </div>
                        {m.match.source !== 'concept' && (
                          <div className="text-[11px] text-stone-500 italic mt-0.5 leading-snug">
                            matched on “{matchedText}”
                          </div>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Catalogue groups */}
          <div className="max-h-[60vh] overflow-y-auto pr-0.5 [scrollbar-gutter:stable]">
            {!data && (
              <p className="text-xs text-stone-400 italic px-3 py-4">Loading…</p>
            )}
            {data && filteredGroups.length === 0 && matches.length === 0 && q && (
              <p className="text-xs text-stone-400 italic px-3 py-4">No matches.</p>
            )}
            {filteredGroups.map((g) => {
              const isOpen = !!open[g.organ]
              return (
                <div key={g.organ} className="border-b border-stone-100 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [g.organ]: !o[g.organ] }))}
                    aria-expanded={isOpen}
                    className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-stone-100 transition"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      {isOpen
                        ? <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />
                        : <ChevronRight className="w-3.5 h-3.5 text-stone-400 shrink-0" aria-hidden="true" />}
                      <OrganIcon
                        organ={g.organ}
                        className="w-5 h-5 text-amber-600 shrink-0"
                      />
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-600 truncate">
                        {g.organ.replace(/_/g, ' ')}
                      </span>
                    </span>
                    <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                      {g.total}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="pb-2">
                      {g.parents.map((p) => (
                        <div key={`${g.organ}-${p.name}`}>
                          {/* Parent_concept segment label — specific organ type */}
                          <div className="pl-9 pr-3 pt-2 pb-1 flex items-baseline justify-between gap-2">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-stone-400 truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-stone-300 tabular-nums">
                              {p.concepts.length}
                            </span>
                          </div>
                          <ul>
                            {p.concepts.map((c) => {
                              const isSelected = selected === c
                              return (
                                <li key={c}>
                                  <button
                                    type="button"
                                    onClick={() => setSelected(c)}
                                    className={`w-full text-left px-3 py-1.5 pl-9 text-xs transition ${
                                      isSelected
                                        ? 'bg-red-50 text-red-800 font-semibold border-l-2 border-red-800 pl-[34px]'
                                        : 'text-stone-700 hover:bg-stone-100 hover:text-stone-900'
                                    }`}
                                  >
                                    {c}
                                  </button>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>

        {/* ── Detail panel ───────────────────────────────────────── */}
        <section className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 min-h-[60vh]">
          {!selected || !concept ? (
            <div className="py-8">
              <div className="max-w-xl mx-auto">
                {/* What this page does */}
                <p className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-2">
                  Browse symptoms by organ
                </p>
                <h2 className="text-base font-semibold text-red-800 mb-2 leading-snug">
                  Pick a clinical concept from the sidebar to see its definition and the
                  ciliopathies that exhibit it.
                </h2>
                <p className="text-xs text-stone-600 leading-relaxed mb-6">
                  Each concept is mapped to an HPO identifier and cross-referenced against
                  the {data ? totalConcepts : 'curated'}-concept catalogue. The detail view
                  shows the HPO definition, ciliopathy class breakdown, and the diseases that
                  report it, with evidence counts and OMIM provenance.
                </p>

                {/* Quick-pick examples */}
                <p className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mb-3">
                  Try a well-known concept
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-6">
                  {EXAMPLE_CONCEPTS.map((ex) => {
                    const available = data && (data.concepts || {})[ex.name]
                    return (
                      <li key={ex.name}>
                        <button
                          type="button"
                          disabled={!available}
                          onClick={() => setSelected(ex.name)}
                          className="w-full text-left px-3 py-2 rounded border border-stone-200 hover:border-red-800 hover:bg-red-50/30 disabled:opacity-40 disabled:hover:border-stone-200 disabled:hover:bg-transparent disabled:cursor-not-allowed transition group"
                        >
                          <div className="text-xs font-semibold text-stone-900 group-hover:text-red-800 transition leading-tight">
                            {ex.name}
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5">{ex.hint}</div>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* Search hint */}
                <p className="text-[11px] text-stone-500 leading-relaxed">
                  Or use the sidebar search to find a concept by name or free-text phrase
                  (e.g. <span className="font-mono text-stone-700">&ldquo;extra fingers&rdquo;</span> →
                  Polydactyly, <span className="font-mono text-stone-700">&ldquo;brain MRI molar tooth&rdquo;</span> →
                  Molar tooth sign).
                </p>
              </div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="mb-5">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <div className="text-[11px] uppercase tracking-wider font-bold text-red-800">
                    {concept.organ ? concept.organ.replace(/_/g, ' ') : 'Concept'}
                  </div>
                  {primaryHpo && (
                    <a
                      href={`https://hpo.jax.org/browse/term/${primaryHpo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 hover:text-red-800 transition"
                    >
                      {primaryHpo}
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                    </a>
                  )}
                </div>
                <h2 className="text-xl font-bold text-stone-900 tracking-tight leading-tight mt-1.5">
                  {selected}
                </h2>
                {concept.parent_concept && (
                  <p className="text-xs text-stone-400 italic mt-1">↳ {concept.parent_concept}</p>
                )}
              </div>

              {/* HPO definition */}
              {primaryHpo && (
                <div className="mb-6">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
                    HPO definition
                  </p>
                  <p className="text-xs text-stone-700 leading-relaxed">
                    {term?.definition || (
                      <span className="italic text-stone-400">Definition not available.</span>
                    )}
                  </p>
                  {term?.synonyms && term.synonyms.length > 0 && (
                    <p className="text-[12px] text-stone-500 italic mt-2">
                      Also known as: {term.synonyms.slice(0, 5).join('; ')}
                    </p>
                  )}
                </div>
              )}

              {/* Diseases */}
              <div>
                <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-2">
                  Reported in {diseases.length} disease{diseases.length === 1 ? '' : 's'} — ranked by evidence
                </p>
                {diseases.length === 0 ? (
                  <p className="text-xs text-stone-400 italic">No disease associations recorded.</p>
                ) : (
                  <div className="border border-stone-200 rounded overflow-hidden">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-bold uppercase tracking-wider text-stone-600">
                          <th className="py-2 px-3 text-left w-8">#</th>
                          <th className="py-2 px-3 text-left">Disease</th>
                          <th className="py-2 px-3 text-left hidden sm:table-cell">Class</th>
                          <th className="py-2 px-3 text-right">Reference ID</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {diseases.map((d, i) => (
                          <tr key={(d as any).slug || d.name} className="hover:bg-stone-50/50 transition">
                            <td className="py-2 px-3 font-mono text-stone-400 tabular-nums">
                              {String(i + 1).padStart(2, '0')}
                            </td>
                            <td className="py-2 px-3 font-semibold">
                              <Link
                                href={`/disease/${encodeURIComponent(d.name)}`}
                                className="text-stone-900 hover:text-red-800 transition"
                              >
                                {d.name}
                              </Link>
                            </td>
                            <td className="py-2 px-3 text-stone-500 hidden sm:table-cell">
                              {(d as any).class || ''}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              {(() => {
                                const pmids = diseasePmids[normalizeDiseaseName(d.name)] || []
                                if (pmids.length > 0) {
                                  return (
                                    <a
                                      href={`https://pubmed.ncbi.nlm.nih.gov/${pmids[0]}/`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={
                                        pmids.length > 1
                                          ? `${pmids.length} references — showing the most recent`
                                          : 'PubMed reference'
                                      }
                                      className="font-mono text-[12px] text-red-800 hover:text-red-900 underline underline-offset-2"
                                    >
                                      PMID&nbsp;{pmids[0]}
                                      {pmids.length > 1 && (
                                        <span className="text-stone-400"> +{pmids.length - 1}</span>
                                      )}
                                    </a>
                                  )
                                }
                                return (
                                  <a
                                    href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(d.name)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="No indexed PMID — search PubMed for this disease"
                                    className="font-mono text-[12px] text-stone-400 hover:text-red-800 underline underline-offset-2"
                                  >
                                    PubMed&nbsp;↗
                                  </a>
                                )
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  )
}

function lookupConceptByName(data: SymptomsFile, name: string): SymptomConcept | null {
  if (data.concepts[name]) return data.concepts[name]
  const target = name.toLowerCase()
  for (const k of Object.keys(data.concepts)) {
    if (k.toLowerCase() === target) return data.concepts[k]
  }
  return null
}
