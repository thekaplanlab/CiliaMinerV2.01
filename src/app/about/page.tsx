'use client'

/**
 * About — overview + catalogue statistics.
 *
 * Combines the former /about and /analysis pages into one. Order:
 *
 *   1. Header
 *   2. Stat strip — 3 headline counts (genes / diseases / candidates)
 *   3. Overview prose + how-to-cite (citation moved up from the footer)
 *   4. Catalogue breakdown charts:
 *        • genes per disease class
 *        • top diseases by gene count
 *        • top functional categories
 *        • top subcellular localizations
 *        • pan- vs idio-ciliary distribution
 *   5. What's new in this version (changelog block, if present in metadata)
 *   6. Gene inclusion criterion (if present in metadata)
 *   7. Sources (hand-curated list)
 */

import React, { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ExternalLink } from 'lucide-react'

// Cilia-related genes that are not yet linked to a specific ciliopathy.
// CiliaHub catalogue ≈ 2,787 cilia genes; the disease-linked subset is the
// curated set in v15. Adjust here if the CiliaHub master changes.
const CANDIDATE_GENES = 2180

// ── Defensive parsing helpers ─────────────────────────────────────────
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
  if (typeof v === 'string' && v.length > 0) {
    return v.split(';').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

interface Stats {
  genes: number
  diseases: number
}

interface Bar { label: string; value: number }

interface Charts {
  byClass:          Bar[]
  topDiseases:      Bar[]
  fnCategories:     Bar[]
  localizations:    Bar[]
  panIdio:          Bar[]
}

interface Meta {
  version?: string
  generatedAt?: string
  changesInVersion?: string[]
  geneInclusionCriterion?: string
}

export default function AboutPage() {
  return (
    <ErrorBoundary scope="about">
      <Inner />
    </ErrorBoundary>
  )
}

function Inner() {
  const [master, setMaster] = useState<any>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/ciliopathy_genes_v15.json', { cache: 'default' })
      .then((r) => r.json())
      .then((m) => { if (!cancelled) setMaster(m) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const stats = useMemo<Stats | null>(() => {
    if (!master) return null
    // Count diseases that actually have a classification (i.e. live in one
    // of the four class buckets). This matches the sidebar totals on the
    // Disease Classification page. There may be a small number of diseases
    // that are referenced by `gene.ciliopathies` but lack a classification
    // entry — these are catalogue orphans to be cleaned up in curation,
    // not counted here.
    return {
      genes:    Object.keys(master.genes || {}).length,
      diseases: Object.keys(master.disease_classifications || {}).length,
    }
  }, [master])

  const charts = useMemo<Charts | null>(() => {
    if (!master) return null
    const genes = master.genes || {}

    // — Genes per disease class (use precomputed metadata if present)
    const byClassCounts: Record<string, number> =
      (master.metadata?.per_class_gene_counts as Record<string, number>) || {}
    let byClass: Bar[] = Object.entries(byClassCounts).map(([k, v]) => ({ label: k, value: Number(v) || 0 }))
    if (byClass.length === 0) {
      const counts: Record<string, number> = {}
      Object.values(genes).forEach((g: any) => {
        arr(g.ciliopathy_classes).forEach((c) => { counts[c] = (counts[c] || 0) + 1 })
      })
      byClass = Object.entries(counts).map(([k, v]) => ({ label: k, value: v }))
    }
    byClass.sort((a, b) => b.value - a.value)

    // — Top diseases by gene count
    const diseaseCounts: Record<string, number> = {}
    Object.values(genes).forEach((g: any) => {
      arr(g.ciliopathies).forEach((d) => { diseaseCounts[d] = (diseaseCounts[d] || 0) + 1 })
    })
    const topDiseases: Bar[] = Object.entries(diseaseCounts)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)

    // — Functional categories
    const fcCounts: Record<string, number> = {}
    Object.values(genes).forEach((g: any) => {
      arr(g.functional_category).forEach((c) => { fcCounts[c] = (fcCounts[c] || 0) + 1 })
    })
    const fnCategories: Bar[] = Object.entries(fcCounts)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)

    // — Subcellular localizations
    const locCounts: Record<string, number> = {}
    Object.values(genes).forEach((g: any) => {
      arr(g.localization).forEach((l) => { locCounts[l] = (locCounts[l] || 0) + 1 })
    })
    const localizations: Bar[] = Object.entries(locCounts)
      .map(([k, v]) => ({ label: k, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12)

    // — Pan / idio (prefer metadata, fall back to per-gene counting)
    const panIdioMeta = master.metadata?.pan_idio_distribution as Record<string, number> | undefined
    let panIdio: Bar[] = panIdioMeta
      ? Object.entries(panIdioMeta).map(([k, v]) => ({ label: pretty(k), value: Number(v) || 0 }))
      : (() => {
          const counts: Record<string, number> = {}
          Object.values(genes).forEach((g: any) => {
            const k = pretty(g.pan_idio_class || 'unclassified')
            counts[k] = (counts[k] || 0) + 1
          })
          return Object.entries(counts).map(([k, v]) => ({ label: k, value: v }))
        })()
    panIdio.sort((a, b) => b.value - a.value)

    return { byClass, topDiseases, fnCategories, localizations, panIdio }
  }, [master])

  const meta = useMemo<Meta | null>(() => {
    if (!master) return null
    const m = master.metadata || {}
    return {
      version:                m.version,
      generatedAt:            m.generated_at,
      changesInVersion:       m.changes_in_this_version,
      geneInclusionCriterion: m.gene_inclusion_criterion,
    }
  }, [master])

  return (
    <Layout>
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="mb-4">
        <h1 className="text-lg font-bold text-red-800 tracking-tight">About CiliaMiner</h1>
        <p className="text-xs text-stone-500 mt-1">
          A curated ciliopathy database for clinical and translational research.
        </p>
      </div>

      {/* ── Stat strip ──────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden mb-6">
        <div className="grid grid-cols-3 divide-x divide-stone-200">
          <StatCell value={stats?.genes}            label="Ciliopathy genes" hint="Curated genes with at least one ciliopathy association" />
          <StatCell value={stats?.diseases}         label="Ciliopathies"     hint="Distinct disease entries in the catalogue" />
          <StatCell value={CANDIDATE_GENES}         label="Candidate genes"  hint="Cilia-related genes not yet linked to a specific disease" />
        </div>
      </div>

      {/* ── Overview ──────────────────────────────────────────── */}
      <Card>
        <Eyebrow>Overview</Eyebrow>
        <div className="space-y-3 text-xs text-stone-700 leading-relaxed">
          <p>
            <span className="font-semibold text-stone-900">CiliaMiner</span> is a curated
            knowledgebase of human ciliopathies — genetic disorders caused by defects in
            primary, motile, or sensory cilia. The database links genes, diseases, and
            clinical features through a single relational layer that supports diagnostic
            reasoning, variant prioritisation, and comparative analysis.
          </p>
          <p>
            Symptom records are derived from OMIM clinical synopses and mapped to canonical
            concepts in the Human Phenotype Ontology (HPO). Disease classifications are
            curated from the literature into four functional groups: primary, secondary,
            motile, and tissue-restricted ciliopathies.
          </p>
        </div>

        {/* How to cite — moved up from the page footer into the overview */}
        <div className="mt-5 pt-5 border-t border-stone-200">
          <Eyebrow>How to cite</Eyebrow>
          <p className="text-xs text-stone-700 leading-relaxed mb-3">
            If you use CiliaMiner in your work, please cite:
          </p>
          <p className="text-xs text-stone-700 italic leading-relaxed">
            Turan M.G., Orhan M.E., et&nbsp;al. CiliaMiner: a manually curated database of
            ciliopathies and ciliary genes. <span className="not-italic font-semibold">Database</span> (Oxford). 2023.
          </p>
          <a
            href="https://doi.org/10.1093/database/baad047"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-red-800 hover:text-red-900 transition"
          >
            <span>doi.org/10.1093/database/baad047</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </Card>

      {/* ── Catalogue charts ──────────────────────────────────── */}
      {!charts && (
        <Card>
          <p className="text-xs text-stone-400 italic">Loading catalogue stats…</p>
        </Card>
      )}

      {charts && (
        <>
          <ChartCard
            eyebrow="Genes per disease class"
            note={`${charts.byClass.length} classes`}
            description="Number of genes assigned to each disease class — a gene can contribute to several classes when it causes multiple ciliopathies."
          >
            <HorizontalBars data={charts.byClass} accentTop={1} />
          </ChartCard>

          <ChartCard
            eyebrow="Top diseases by gene count"
            note="top 12"
            description="Ciliopathies with the most curated causative genes."
          >
            <HorizontalBars data={charts.topDiseases} accentTop={3} />
          </ChartCard>

          <ChartCard
            eyebrow="Functional categories"
            note="top 12"
            description="Functional themes represented across the catalogue — a gene typically belongs to several."
          >
            <HorizontalBars data={charts.fnCategories} accentTop={3} />
          </ChartCard>

          <ChartCard
            eyebrow="Subcellular localizations"
            note="top 12"
            description="Where cilia-related proteins are observed inside the cell."
          >
            <HorizontalBars data={charts.localizations} accentTop={3} />
          </ChartCard>

          <ChartCard
            eyebrow="Pan- vs idio-ciliary"
            note={`${charts.panIdio.length} categories`}
            description="Whether the gene is expressed widely across ciliated tissues (pan-ciliary) or restricted to a specific ciliated subtype (idio-ciliary)."
          >
            <HorizontalBars data={charts.panIdio} accentTop={1} />
          </ChartCard>
        </>
      )}

      {/* ── What's new in this version ───────────────────────────── */}
      {meta && Array.isArray(meta.changesInVersion) && meta.changesInVersion.length > 0 && (
        <Card>
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
              What's new {meta.version && <span className="text-stone-300 ml-1">· v{meta.version}</span>}
            </p>
            {meta.generatedAt && (
              <span className="text-[11px] font-mono text-stone-400 tabular-nums">
                {meta.generatedAt}
              </span>
            )}
          </div>
          <ul className="space-y-2 text-xs text-stone-700 leading-relaxed">
            {meta.changesInVersion.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-red-800 shrink-0 select-none mt-1">·</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ── Gene inclusion criterion ────────────────────────────── */}
      {meta?.geneInclusionCriterion && (
        <Card>
          <Eyebrow>Gene inclusion criterion</Eyebrow>
          <p className="text-xs text-stone-700 leading-relaxed">
            {meta.geneInclusionCriterion}
          </p>
        </Card>
      )}

      {/* ── Sources ──────────────────────────────────────────── */}
      <Card>
        <Eyebrow>Sources</Eyebrow>
        <ul className="space-y-2 text-xs text-stone-700">
          <SourceRow name="OMIM"                     description="Clinical synopses for each disease"           url="https://omim.org" />
          <SourceRow name="Human Phenotype Ontology" description="Canonical phenotype concepts and ID space"    url="https://hpo.jax.org" />
          <SourceRow name="Ensembl"                  description="Gene identifiers, transcript coordinates"     url="https://www.ensembl.org" />
          <SourceRow name="UniProt"                  description="Protein sequences and functional annotation"  url="https://www.uniprot.org" />
          <SourceRow name="ClinVar"                  description="Variants and clinical significance"           url="https://www.ncbi.nlm.nih.gov/clinvar" />
        </ul>
      </Card>
    </Layout>
  )
}

// ── Reusable bits ───────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 mb-6">
      {children}
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400 mb-3">
      {children}
    </p>
  )
}

function StatCell({
  value, label, hint,
}: {
  value: number | undefined
  label: string
  hint?: string
}) {
  return (
    <div className="p-6 text-center bg-white">
      <div className="text-4xl font-bold text-stone-900 tabular-nums leading-none">
        {value === undefined ? '—' : value.toLocaleString()}
      </div>
      <div className="text-[11px] uppercase tracking-wider font-bold text-stone-500 mt-3">
        {label}
      </div>
      {hint && (
        <div className="text-[12px] text-stone-400 mt-2 leading-snug">
          {hint}
        </div>
      )}
    </div>
  )
}

function SourceRow({ name, description, url }: { name: string; description: string; url: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-stone-900 hover:text-red-800 transition inline-flex items-baseline gap-1 shrink-0"
      >
        <span>{name}</span>
        <ExternalLink className="w-3 h-3" aria-hidden="true" />
      </a>
      <span className="text-stone-500">{description}</span>
    </li>
  )
}

function ChartCard({
  eyebrow, note, description, children,
}: {
  eyebrow: string
  note?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 mb-6">
      <div className="flex items-baseline justify-between mb-1.5 gap-3">
        <p className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
          {eyebrow}
        </p>
        {note && (
          <span className="text-[11px] font-mono text-stone-400 tabular-nums">{note}</span>
        )}
      </div>
      {description && (
        <p className="text-xs text-stone-500 leading-relaxed mb-4 max-w-2xl">{description}</p>
      )}
      {children}
    </div>
  )
}

/**
 * Horizontal bars in the same red-800/stone palette as the rest of the
 * redesigned site. Top `accentTop` rows are shown in the red accent;
 * everything else is in stone-300 for visual hierarchy.
 */
function HorizontalBars({
  data, accentTop = 0,
}: {
  data: Bar[]
  accentTop?: number
}) {
  if (data.length === 0) {
    return <p className="text-xs text-stone-400 italic">No data.</p>
  }
  const max = Math.max(...data.map((d) => d.value), 1)
  return (
    <ol className="space-y-1.5">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100
        const isAccent = i < accentTop
        return (
          <li key={d.label} className="flex items-center gap-3 text-xs">
            <span
              className="w-[max(140px,32%)] shrink-0 truncate text-stone-700"
              title={d.label}
            >
              {d.label}
            </span>
            <div className="flex-1 relative h-4 bg-stone-50 rounded-sm overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 transition-[width] duration-500 ${
                  isAccent ? 'bg-red-800/85' : 'bg-stone-300'
                }`}
                style={{ width: `${pct}%` }}
                aria-label={`${d.value}`}
              />
            </div>
            <span className="font-mono text-stone-500 tabular-nums w-12 text-right shrink-0">
              {d.value.toLocaleString()}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// "pan_ciliary" → "Pan-ciliary"
function pretty(k: string): string {
  if (!k) return 'Unclassified'
  return k
    .replace(/_/g, '-')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace('Idio-ciliary', 'Idio-ciliary')
}
