'use client'

/**
 * GeneHpoPhenotype — aggregated clinical phenotype for a gene, derived from
 * the HPO-coded concept sets of its associated diseases.
 *
 * A ciliopathy gene is typically implicated in one or more diseases; each of
 * those diseases has a curated symptom profile in clinical_features_v1.json
 * with HPO-coded canonical concepts organised by organ system. This
 * component aggregates those concepts up to the gene level:
 *
 *     gene → [diseases] → [concepts with HPO IDs, per organ, per disease]
 *
 * Coverage is stated up-front: not every disease in v15 has curated OMIM
 * symptom data (currently 76 of 104). Genes whose associated diseases lack
 * curated data get a small explanatory card instead of an empty section.
 *
 * Data source: clinical_features_v1.json (the same file that powers the
 * CilioSymptom differential-dx layer). Loaded lazily on mount.
 *
 * Styling: matches the gene page's shared `card` / `eyebrow` classes and
 * primary-* / accent design tokens.
 */

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, Download, ExternalLink, Loader2 } from 'lucide-react'

// ── Data shape (matches clinicalFeaturesData.ts) ─────────────────────
interface ConceptEntry {
  concept:        string
  hpo_id:         string | null
  parent_concept: string
  evidence_count: number
}
interface DiseaseRecord {
  by_organ_records?: Record<string, ConceptEntry[]>
}
interface ClinicalFile {
  diseases: Record<string, DiseaseRecord>
}

// ── Loader (same pattern as ciliosymptomDx / geneSetAnalysis) ────────
let CLINICAL:  ClinicalFile | null = null
let inflight:  Promise<ClinicalFile> | null = null
async function loadClinical(): Promise<ClinicalFile> {
  if (CLINICAL) return CLINICAL
  if (inflight) return inflight
  inflight = fetch('/data/clinical_features_v1.json', { cache: 'default' })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load clinical_features_v1.json: ${r.status}`)
      return r.json() as Promise<ClinicalFile>
    })
    .then((c) => { CLINICAL = c; return c })
  return inflight
}

// ── Aggregation ──────────────────────────────────────────────────────
interface AggregatedConcept {
  concept:        string
  hpo_id:         string | null
  parent_concept: string
  by_disease:     Array<{ disease: string; evidence: number }>
  total_evidence: number
}
interface OrganGroup {
  organ:    string
  concepts: AggregatedConcept[]
}
interface Aggregation {
  organs:           OrganGroup[]
  total_concepts:   number
  total_hpo_ids:    number
  diseases_covered: string[]
  diseases_missing: string[]
}

function aggregate(
  associatedDiseases: string[],
  clinical:           ClinicalFile,
): Aggregation {
  const covered:  string[] = []
  const missing:  string[] = []

  interface ConceptAgg {
    concept:        string
    hpo_id:         string | null
    parent_concept: string
    by_disease:     Map<string, number>
  }
  const byOrgan = new Map<string, Map<string, ConceptAgg>>()

  associatedDiseases.forEach((d) => {
    const rec = clinical.diseases[d]
    if (!rec) { missing.push(d); return }
    covered.push(d)
    const bor = rec.by_organ_records || {}
    Object.entries(bor).forEach(([organ, entries]) => {
      if (!Array.isArray(entries)) return
      let organMap = byOrgan.get(organ)
      if (!organMap) { organMap = new Map(); byOrgan.set(organ, organMap) }
      entries.forEach((e) => {
        if (!e || typeof e.concept !== 'string') return
        let agg = organMap!.get(e.concept)
        if (!agg) {
          agg = {
            concept:        e.concept,
            hpo_id:         e.hpo_id || null,
            parent_concept: e.parent_concept || '',
            by_disease:     new Map(),
          }
          organMap!.set(e.concept, agg)
        }
        agg.by_disease.set(d, (agg.by_disease.get(d) || 0) + (e.evidence_count || 1))
      })
    })
  })

  const organs: OrganGroup[] = []
  const allHpoIds = new Set<string>()
  let totalConcepts = 0

  Array.from(byOrgan.entries())
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .forEach(([organ, cmap]) => {
      const concepts: AggregatedConcept[] = Array.from(cmap.values())
        .map((c) => {
          const bd = Array.from(c.by_disease.entries())
            .map(([disease, evidence]) => ({ disease, evidence }))
            .sort((x, y) => y.evidence - x.evidence)
          const total = bd.reduce((s, e) => s + e.evidence, 0)
          if (c.hpo_id) allHpoIds.add(c.hpo_id)
          totalConcepts++
          return {
            concept:        c.concept,
            hpo_id:         c.hpo_id,
            parent_concept: c.parent_concept,
            by_disease:     bd,
            total_evidence: total,
          }
        })
        .sort((a, b) => b.total_evidence - a.total_evidence || a.concept.localeCompare(b.concept))
      organs.push({ organ, concepts })
    })

  return {
    organs,
    total_concepts:   totalConcepts,
    total_hpo_ids:    allHpoIds.size,
    diseases_covered: covered,
    diseases_missing: missing,
  }
}

// ── Component ────────────────────────────────────────────────────────
export function GeneHpoPhenotype({
  symbol,
  associatedDiseases,
}: {
  symbol:             string
  associatedDiseases: string[]
}) {
  const [clinical, setClinical] = useState<ClinicalFile | null>(null)
  const [err,      setErr]      = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [copied,   setCopied]   = useState(false)

  useEffect(() => {
    let cancelled = false
    loadClinical()
      .then((c) => { if (!cancelled) setClinical(c) })
      .catch((e) => { if (!cancelled) setErr((e as Error)?.message ?? 'load failed') })
    return () => { cancelled = true }
  }, [])

  const agg = useMemo<Aggregation | null>(() => {
    if (!clinical || !associatedDiseases || associatedDiseases.length === 0) return null
    return aggregate(associatedDiseases, clinical)
  }, [clinical, associatedDiseases])

  useEffect(() => {
    if (!agg) return
    const next: Record<string, boolean> = {}
    agg.organs.slice(0, 3).forEach((o) => { next[o.organ] = true })
    setExpanded(next)
  }, [agg])

  // ── No associated diseases at all — render nothing ────────────────
  if (!associatedDiseases || associatedDiseases.length === 0) {
    return null
  }

  // ── Error state ───────────────────────────────────────────────────
  if (err) {
    return (
      <section className="card p-6 sm:p-7">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <h2 className="eyebrow">Clinical phenotype</h2>
        </div>
        <p className="text-xs text-primary-600">
          Couldn&rsquo;t load curated symptom data: <span className="font-mono">{err}</span>
        </p>
      </section>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────
  if (!clinical || !agg) {
    return (
      <section className="card p-6 sm:p-7">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <h2 className="eyebrow">Clinical phenotype</h2>
        </div>
        <p className="text-xs text-primary-400 inline-flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
          Loading curated symptom data…
        </p>
      </section>
    )
  }

  // ── None of this gene's diseases have curated symptoms ───────────
  if (agg.total_concepts === 0) {
    return (
      <section className="card p-6 sm:p-7">
        <div className="flex items-baseline justify-between mb-4 gap-3">
          <h2 className="eyebrow">Clinical phenotype</h2>
        </div>
        <p className="text-xs text-primary-700 leading-relaxed">
          Curated OMIM-derived symptom profiles are not yet available for the
          {associatedDiseases.length === 1 ? ' disease' : ` ${associatedDiseases.length} diseases`}
          {' '}associated with <span className="font-mono">{symbol}</span>. The
          catalogue currently covers 76 of 104 classified ciliopathies; entries
          for broader umbrella disorders or recently added conditions may lack
          structured phenotype data. Browse curated concepts on the{' '}
          <Link
            href="/symptoms-diseases"
            className="text-accent hover:text-accent-dark underline-offset-2 hover:underline font-medium"
          >
            Symptoms page
          </Link>.
        </p>
      </section>
    )
  }

  // ── Copy / CSV helpers ────────────────────────────────────────────
  const allHpoIds: string[] = []
  agg.organs.forEach((o) => o.concepts.forEach((c) => {
    if (c.hpo_id && !allHpoIds.includes(c.hpo_id)) allHpoIds.push(c.hpo_id)
  }))

  function copyHpo() {
    if (!allHpoIds.length) return
    navigator.clipboard.writeText(allHpoIds.join(', ')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  function downloadCsv() {
    if (!agg) return
    const aggregation = agg
    const header = ['organ', 'concept', 'hpo_id', 'parent_concept', 'diseases', 'total_evidence']
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
    const rows: string[] = [header.join(',')]
    aggregation.organs.forEach((o) => o.concepts.forEach((c) => {
      const diseaseStr = c.by_disease.map((bd) => `${bd.disease} (${bd.evidence})`).join('; ')
      rows.push([
        o.organ,
        esc(c.concept),
        c.hpo_id || '',
        esc(c.parent_concept),
        esc(diseaseStr),
        String(c.total_evidence),
      ].join(','))
    }))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `${symbol}_clinical_phenotype_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const coverageNote =
    agg.diseases_missing.length === 0
      ? `Aggregated across all ${agg.diseases_covered.length} associated disease${agg.diseases_covered.length === 1 ? '' : 's'}.`
      : `Aggregated across ${agg.diseases_covered.length} of ${associatedDiseases.length} associated diseases with curated symptom data.`

  return (
    <section className="card p-6 sm:p-7">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <h2 className="eyebrow">Clinical phenotype</h2>
        <span className="text-[12px] font-mono text-primary-400 tabular-nums">
          {agg.total_concepts} concept{agg.total_concepts === 1 ? '' : 's'} · {agg.total_hpo_ids} HPO
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 mb-3">
        <button
          type="button"
          onClick={copyHpo}
          disabled={allHpoIds.length === 0}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-muted hover:bg-surface border border-primary-100 hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition rounded text-[11px] font-medium text-primary-700"
          title="Copy the aggregated HPO ID list"
        >
          <Copy className="w-3 h-3" aria-hidden="true" />
          <span>{copied ? 'Copied' : `Copy ${allHpoIds.length} HPO`}</span>
        </button>
        <button
          type="button"
          onClick={downloadCsv}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-muted hover:bg-surface border border-primary-100 hover:border-accent hover:text-accent transition rounded text-[11px] font-medium text-primary-700"
          title="Download the full phenotype table as CSV"
        >
          <Download className="w-3 h-3" aria-hidden="true" />
          <span>CSV</span>
        </button>
      </div>

      {/* Coverage note */}
      <p className="text-[12px] text-primary-500 mb-4 leading-relaxed">
        {coverageNote}{' '}
        Concepts are canonicalised leaves in the CilioSymptom corpus with published
        HPO identifiers; per-concept evidence counts come from OMIM clinical-synopsis
        provenance.
      </p>
      {agg.diseases_missing.length > 0 && (
        <p className="text-[11px] text-primary-400 italic mb-4">
          No curated symptom data for: {agg.diseases_missing.join(', ')}.
        </p>
      )}

      {/* Organ-grouped concept list */}
      <ul className="space-y-3">
        {agg.organs.map((g) => {
          const isOpen  = !!expanded[g.organ]
          const preview = isOpen ? g.concepts : g.concepts.slice(0, 5)
          return (
            <li key={g.organ} className="border-l-2 border-primary-100 pl-3">
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <p className="text-[11px] uppercase tracking-[0.14em] font-medium text-accent">
                  {g.organ.replace(/_/g, ' ')}
                </p>
                <span className="text-[11px] font-mono text-primary-400 tabular-nums">
                  {g.concepts.length} concept{g.concepts.length === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="space-y-1.5">
                {preview.map((c) => (
                  <li key={c.concept}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <Link
                        href={`/symptoms-diseases#concept=${encodeURIComponent(c.concept)}`}
                        className="text-xs font-medium text-primary-800 hover:text-accent transition-colors"
                      >
                        {c.concept}
                      </Link>
                      {c.hpo_id && (
                        <a
                          href={`https://hpo.jax.org/browse/term/${c.hpo_id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-[11px] font-mono text-primary-500 hover:text-accent transition-colors"
                          title="Open at hpo.jax.org"
                        >
                          {c.hpo_id}
                          <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                    <p className="text-[11px] text-primary-500 mt-0.5">
                      {c.by_disease.map((bd, i) => (
                        <span key={bd.disease}>
                          {i > 0 && <span className="text-primary-300 mx-1">·</span>}
                          <Link
                            href={`/disease/${encodeURIComponent(bd.disease)}`}
                            className="hover:text-accent transition-colors"
                          >
                            {bd.disease}
                          </Link>
                          <span className="text-primary-400 tabular-nums ml-1">
                            ({bd.evidence})
                          </span>
                        </span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
              {g.concepts.length > 5 && (
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [g.organ]: !e[g.organ] }))}
                  className="text-[11px] font-mono text-primary-400 hover:text-accent transition-colors mt-2"
                >
                  {isOpen ? 'show top 5' : `show all ${g.concepts.length}`}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
