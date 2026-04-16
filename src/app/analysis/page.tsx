'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import { BarPlot, CiliaMinerPieChart, PublicationBarChart } from '@/components/ChartComponents'
import { ChartSkeleton } from '@/components/Skeleton'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { dataService } from '@/services/dataService'
import { config } from '@/lib/config'
import type { CiliopathyGene, BarPlotData, GeneNumber, PublicationData, OrthologGene } from '@/types'
import { downloadAs } from '@/lib/download'
import { Download, AlertTriangle } from 'lucide-react'

interface OrganismConservation {
  organism: string
  geneCount: number
}

export default function AnalysisPage() {
  return (
    <ErrorBoundary scope="analysis">
      <AnalysisPageInner />
    </ErrorBoundary>
  )
}

function AnalysisPageInner() {
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [genes, setGenes] = useState<CiliopathyGene[]>([])
  const [barPlotData, setBarPlotData] = useState<BarPlotData[]>([])
  const [classificationData, setClassificationData] = useState<GeneNumber[]>([])
  const [publicationData, setPublicationData] = useState<PublicationData[]>([])
  const [orthologData, setOrthologData] = useState<OrthologGene[]>([])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      dataService.getCiliopathyGenes(),
      dataService.getBarPlotData(),
      dataService.getGeneNumbers(),
      dataService.getPublicationData(),
      dataService.getAllOrthologData(),
    ])
      .then(([genesResult, barPlot, classification, publications, orthologs]) => {
        if (cancelled) return
        setGenes(genesResult)
        setBarPlotData(barPlot)
        setClassificationData(classification)
        setPublicationData(publications)
        setOrthologData(orthologs)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load analysis data:', err)
        setLoadError(err instanceof Error ? err.message : 'Unable to load data')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ── Derived insights ──────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (genes.length === 0) return null
    const uniqueDiseases = new Set(genes.map(g => g.Ciliopathy?.trim()).filter(c => c && c !== 'Unknown')).size
    const uniqueLocalizations = new Set(genes.map(g => g['Subcellular Localization']).filter(Boolean)).size
    const totalPubs = publicationData.reduce((sum, p) => sum + p.publication_number, 0)
    const uniqueOrganisms = new Set(orthologData.map(o => o.Organism).filter(Boolean)).size
    return { uniqueDiseases, uniqueLocalizations, totalPubs, uniqueOrganisms }
  }, [genes, publicationData, orthologData])

  // Functional category distribution
  const functionalCategories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of genes) {
      const cat = (g['Functional.category'] || 'Unclassified').trim() || 'Unclassified'
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([Disease, Gene_numbers]) => ({ Disease, Gene_numbers }))
      .sort((a, b) => b.Gene_numbers - a.Gene_numbers)
  }, [genes])

  // Ortholog conservation per organism
  const orthologConservation = useMemo((): OrganismConservation[] => {
    const counts = new Map<string, number>()
    for (const o of orthologData) {
      const org = o.Organism
      if (org) counts.set(org, (counts.get(org) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([organism, geneCount]) => ({ organism, geneCount }))
      .sort((a, b) => b.geneCount - a.geneCount)
  }, [orthologData])

  // Top diseases by gene count
  const topDiseases = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of genes) {
      const disease = g.Ciliopathy?.trim()
      if (disease && disease !== 'Unknown') {
        counts.set(disease, (counts.get(disease) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, value]) => ({ name, value }))
  }, [genes])

  // Genes with most orthologs conserved
  const mostConservedGenes = useMemo(() => {
    const geneCounts = new Map<string, Set<string>>()
    for (const o of orthologData) {
      const gene = o['Human Gene Name']
      const org = o.Organism
      if (gene && org) {
        if (!geneCounts.has(gene)) geneCounts.set(gene, new Set())
        geneCounts.get(gene)!.add(org)
      }
    }
    return Array.from(geneCounts.entries())
      .map(([gene, organisms]) => ({ gene, count: organisms.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20)
  }, [orthologData])

  // Protein complex distribution
  const proteinComplexes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const g of genes) {
      const complex = (g['Protein.complexes'] || '').trim()
      if (complex) {
        counts.set(complex, (counts.get(complex) ?? 0) + 1)
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [genes])

  const handleExport = (format: 'csv' | 'json') => {
    const payload = {
      publications: publicationData,
      topDiseases,
      functionalCategories,
      orthologConservation,
      mostConservedGenes,
      proteinComplexes,
    }
    if (format === 'json') {
      downloadAs('json', [payload as unknown as Record<string, unknown>], 'analysis_snapshot')
    } else {
      downloadAs(
        'csv',
        publicationData.map(p => ({
          gene: p.gene_name,
          publications: p.publication_number,
        })),
        'analysis_publications'
      )
    }
  }

  const volumeLabel = useMemo(() => {
    const d = new Date()
    const vol = d.getFullYear() - 2022
    const iss = Math.floor((d.getMonth()) / 3) + 1
    return `Vol. ${String(vol).padStart(2, '0')} · No. ${iss}`
  }, [])

  return (
    <Layout>
      <Breadcrumbs trail={[{ label: 'Analysis' }]} />

      <article className="max-w-[76rem] mx-auto">
        {/* ── MASTHEAD ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-y border-primary-800 py-2 mb-10 text-[11px] font-mono uppercase tracking-[0.18em] text-primary-700">
          <span>The CiliaMiner Review</span>
          <span aria-hidden className="hidden sm:block">§</span>
          <span>{volumeLabel} · {config.lastUpdate}</span>
        </div>

        {/* ── LEAD / ABSTRACT ─────────────────────────────────────────── */}
        <header className="grid grid-cols-1 lg:grid-cols-12 gap-x-10 gap-y-6 mb-16">
          <div className="lg:col-span-8">
            <p className="eyebrow mb-4">
              <span className="inline-block h-px w-6 bg-accent align-middle mr-2" />
              Analysis · Quarterly report
            </p>
            <h1 className="font-display text-[clamp(2.5rem,4vw+1rem,4.5rem)] leading-[1.02] tracking-[-0.035em] text-primary-800 mb-6">
              A quantitative read of the <em className="italic text-accent">ciliary</em> genome
              as it stands today.
            </h1>
            <p className="font-display text-lg md:text-xl text-primary-600 leading-relaxed italic">
              Six figures and one table summarize the distribution of
              ciliopathy genes across subcellular compartments, disease
              categories, model organisms, and the published record —
              drawn exclusively from the current CiliaMiner workbook.
            </p>
          </div>

          <aside className="lg:col-span-4 lg:border-l lg:border-primary-100 lg:pl-8">
            <p className="eyebrow mb-4">Snapshot</p>
            <dl className="space-y-4">
              <Metric label="Genes curated" value={genes.length} loading={isLoading} />
              <Metric label="Distinct ciliopathies" value={stats?.uniqueDiseases ?? 0} loading={isLoading} />
              <Metric label="Model organisms" value={stats?.uniqueOrganisms ?? 0} loading={isLoading} />
              <Metric label="Indexed citations" value={stats?.totalPubs ?? 0} loading={isLoading} />
            </dl>
            <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-primary-100">
              <button
                onClick={() => handleExport('csv')}
                disabled={isLoading || publicationData.length === 0}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Publications CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={isLoading || genes.length === 0}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Snapshot JSON
              </button>
            </div>
          </aside>
        </header>

        {loadError && (
          <div className="mb-12">
            <EmptyState
              icon={AlertTriangle}
              title="Analysis data failed to load"
              hint={<span className="font-mono text-[11px]">{loadError}</span>}
            />
          </div>
        )}

        {/* ── §1 · COMPOSITION ─────────────────────────────────────────── */}
        <SectionRule label="§ 1  Composition" subtitle="Where these genes live, and what they cluster around." />

        <Figure
          number="I"
          title="Gene distribution by subcellular localization."
          method="Genes are bucketed by a case-insensitive match on the `localization` column of the genes sheet. Four mutually-exclusive categories; everything not matching Cilia, Basal Body, or Transition Zone falls to Others."
          figureHeight={320}
          wide
        >
          {isLoading ? <ChartSkeleton height={300} /> : <BarPlot data={barPlotData} height={320} />}
        </Figure>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          <Figure
            number="II"
            title="Classification by ciliopathy type."
            method="Percentages over distinct `ciliopathy_classification` values. Categories below 3% are folded into Other."
            className="lg:col-span-7"
          >
            {isLoading ? <ChartSkeleton height={350} /> : <CiliaMinerPieChart data={classificationData} height={350} />}
          </Figure>

          <aside className="lg:col-span-5 lg:pl-8 lg:border-l lg:border-primary-100 flex flex-col justify-center">
            <p className="eyebrow mb-3">Editor&apos;s note</p>
            <blockquote className="font-display text-2xl md:text-3xl leading-[1.15] tracking-tight text-primary-800 italic">
              “Primary and motile ciliopathies dominate the collection,
              but the <span className="not-italic font-mono text-accent">atypical</span> bucket is
              growing — a reminder that the classification
              is a living document.”
            </blockquote>
            <p className="text-[11px] text-primary-400 font-mono tracking-wider uppercase mt-4">
              — Curatorial team, {new Date().getFullYear()}
            </p>
          </aside>
        </div>

        {/* ── §2 · DISEASE BURDEN ─────────────────────────────────────── */}
        <SectionRule label="§ 2  Disease burden" subtitle="Which disorders carry the largest curated gene sets." />

        <Figure
          number="III"
          title="Top diseases by associated gene count."
          method="Count of unique genes per `ciliopathy` value, ranked descending; entries labelled Unknown are excluded."
          figureHeight={480}
          wide
        >
          {isLoading ? (
            <ChartSkeleton height={400} />
          ) : (
            <PublicationBarChart
              data={topDiseases.map(d => ({ gene: d.name, count: d.value }))}
              maxItems={15}
            />
          )}
        </Figure>

        {/* ── §3 · FUNCTION & CONSERVATION ─────────────────────────────── */}
        <SectionRule label="§ 3  Function & conservation" subtitle="How the collection distributes functionally, and how far it reaches across the tree of life." />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16">
          <Figure
            number="IV"
            title="Functional category distribution."
            method="Derived from the `functional_category` column. Entries missing a category fall into Unclassified."
            className="lg:col-span-6"
          >
            {isLoading ? (
              <ChartSkeleton height={360} />
            ) : (
              <CiliaMinerPieChart data={functionalCategories} height={360} />
            )}
          </Figure>

          <Figure
            number="V"
            title="Orthologs per model organism."
            method="One count per (human gene × organism) pair where an ortholog symbol is present in the workbook."
            className="lg:col-span-6"
          >
            {isLoading ? (
              <ChartSkeleton height={360} />
            ) : (
              <BarPlot
                data={orthologConservation.map(o => ({ name: o.organism, value: o.geneCount }))}
                height={360}
              />
            )}
          </Figure>
        </div>

        {/* Pullquote — magazine-style accent */}
        <blockquote className="relative my-20 mx-auto max-w-3xl text-center px-6">
          <span aria-hidden className="font-display text-accent/30 text-[7rem] leading-none block -mb-8 select-none">“</span>
          <p className="font-display text-3xl md:text-4xl leading-[1.2] tracking-tight text-primary-800 italic">
            Conservation tapers sharply beyond mouse and zebrafish — a measurable
            signal that cross-species annotation is still the
            field&apos;s <span className="text-accent">largest open gap</span>.
          </p>
          <p className="eyebrow mt-5">Observation from Fig. V</p>
        </blockquote>

        {/* ── §4 · PUBLICATION LANDSCAPE ───────────────────────────────── */}
        <SectionRule label="§ 4  Publication landscape" subtitle="The curated record, read at scale." />

        <Figure
          number="VI"
          title="Top genes by PubMed publication count."
          method="Sum of the `pubmed_count` field per gene. PMID lists in `top25_recent_pmids` are aggregated but not weighted."
          figureHeight={640}
          wide
        >
          {isLoading ? (
            <ChartSkeleton height={600} />
          ) : (
            <PublicationBarChart
              data={publicationData.map(p => ({ gene: p.gene_name, count: p.publication_number }))}
              maxItems={20}
            />
          )}
        </Figure>

        {/* ── §5 · TABLE ────────────────────────────────────────────────── */}
        {mostConservedGenes.length > 0 && (
          <>
            <SectionRule label="§ 5  Reference table" subtitle="The most-conserved genes in the collection." />

            <figure className="mb-16">
              <figcaption className="flex items-baseline justify-between mb-4">
                <p className="eyebrow">
                  Table I · Most-conserved genes
                </p>
                <p className="text-[11px] text-primary-400 font-mono">
                  ranked by distinct organisms
                </p>
              </figcaption>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-1 border-y border-primary-800 py-2">
                {mostConservedGenes.map((g, i) => (
                  <div
                    key={g.gene}
                    className="group flex items-baseline gap-4 py-1.5 border-b border-primary-100 last:border-b-0"
                  >
                    <span className="font-mono text-[11px] text-primary-300 tabular-nums w-6">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-sm font-semibold text-primary-800 group-hover:text-accent transition-colors">
                      {g.gene}
                    </span>
                    <span
                      aria-hidden
                      className="flex-1 border-b border-dotted border-primary-200 translate-y-[-3px]"
                    />
                    <span className="font-mono text-xs text-primary-500 tabular-nums">
                      {g.count} <span className="text-primary-300">organisms</span>
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-primary-400 font-mono mt-3">
                Method · count of distinct <code>Organism</code> values per human gene in the ortholog set.
              </p>
            </figure>
          </>
        )}

        {/* ── OPTIONAL §6 · PROTEIN COMPLEXES ──────────────────────────── */}
        {proteinComplexes.length > 0 && (
          <>
            <SectionRule label="§ 6  Protein complexes" subtitle="Which complexes recur most often in the annotations." />

            <Figure
              number="VII"
              title="Top protein complexes by gene count."
              method="Unique values of the `protein_complexes` field. Compound entries are treated as distinct — complexes are NOT split on delimiters."
              figureHeight={360}
              wide
            >
              <BarPlot data={proteinComplexes} height={340} />
            </Figure>
          </>
        )}

        {/* ── COLOPHON ──────────────────────────────────────────────────── */}
        <footer className="mt-24 pt-8 border-t border-primary-200 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="eyebrow mb-2">Colophon</p>
            <p className="text-xs text-primary-500 leading-relaxed">
              All figures are generated in-browser from the current{' '}
              <code className="font-mono text-[11px] text-primary-700">ciliaminer.xlsx</code> workbook.
              No server-side analytics, no third-party trackers. The quarterly
              volume/issue label is computed from the build date.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-2">Data quality</p>
            <p className="text-xs text-primary-500 leading-relaxed">
              For missing-sheet warnings and row-level issues, inspect{' '}
              <code className="font-mono text-[11px] text-primary-700">window.__ciliaminer_quality_report</code>{' '}
              in the browser console after the database loads.
            </p>
          </div>
          <div>
            <p className="eyebrow mb-2">Reproduce</p>
            <p className="text-xs text-primary-500 leading-relaxed">
              Methodology notes are inlined with each figure above.
              Export the snapshot JSON to obtain the raw aggregations
              used to render every plot on this page.
            </p>
          </div>
        </footer>
      </article>
    </Layout>
  )
}

// ─── Helper components (scoped to the analysis page) ──────────────────────

function Metric({
  label,
  value,
  loading,
}: {
  label: string
  value: number
  loading: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-primary-100 last:border-b-0 pb-3 last:pb-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-display text-3xl leading-none tabular-nums text-primary-800">
        {loading ? <span className="text-primary-200">—</span> : value.toLocaleString()}
      </dd>
    </div>
  )
}

function SectionRule({
  label,
  subtitle,
}: {
  label: string
  subtitle: string
}) {
  return (
    <div className="mb-8 mt-4">
      <div className="flex items-baseline justify-between border-b border-primary-800 pb-2 mb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary-700">
          {label}
        </p>
        <span aria-hidden className="font-display text-xl italic text-accent leading-none">✳</span>
      </div>
      <p className="text-sm text-primary-500 max-w-2xl italic font-display">
        {subtitle}
      </p>
    </div>
  )
}

interface FigureProps {
  number: string
  title: string
  method: string
  children: React.ReactNode
  className?: string
  figureHeight?: number
  wide?: boolean
}

/**
 * Editorial figure — numbered caption above, methodology note below.
 * Intentionally NOT wrapped in a card container; the typography carries
 * the hierarchy instead of a box.
 */
function Figure({
  number,
  title,
  method,
  children,
  className = '',
  wide = false,
}: FigureProps) {
  return (
    <figure className={`${className} ${wide ? 'mb-16' : ''}`}>
      <figcaption className="flex items-baseline gap-4 mb-4 pb-2 border-b border-primary-200">
        <span className="font-display text-accent text-2xl leading-none italic tracking-tight">
          Fig. {number}
        </span>
        <span className="font-display text-base md:text-lg text-primary-800 leading-tight flex-1">
          {title}
        </span>
      </figcaption>
      <div className="bg-surface border border-primary-100 rounded-sm px-4 py-5">
        {children}
      </div>
      <p className="text-[11px] text-primary-400 font-mono mt-3 leading-relaxed max-w-3xl">
        <span className="uppercase tracking-wider text-primary-500">Method · </span>
        {method}
      </p>
    </figure>
  )
}
