'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { SearchInput } from '@/components/SearchComponents'
import type { RichSuggestion } from '@/components/SearchComponents'
import { StatCard } from '@/components/ChartComponents'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { CiliopathyGene, PublicationData } from '@/types'
import { dataService } from '@/services/dataService'
import { config } from '@/lib/config'
import { useDebounce } from '@/lib/utils'
import {
  Database,
  Activity,
  FileText,
  Globe,
  ArrowUpRight,
  BarChart3,
  Search,
} from 'lucide-react'

const EXAMPLE_QUERIES = ['BBS1', 'PKD1', 'IFT88', 'Bardet-Biedl', 'Joubert']

export default function HomePage() {
  return (
    <ErrorBoundary scope="home">
      <HomePageInner />
    </ErrorBoundary>
  )
}

function HomePageInner() {
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [publicationData, setPublicationData] = useState<PublicationData[]>([])
  const [cachedGenes, setCachedGenes] = useState<CiliopathyGene[]>([])
  const [diseasePool, setDiseasePool] = useState<string[]>([])
  const [stats, setStats] = useState({
    totalGenes: 0,
    totalCiliopathies: 0,
    totalPublications: 0,
    totalOrganisms: 0,
  })

  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setIsDataLoading(true)
      const [genes, publications, orthologs] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getPublicationData(),
        dataService.getAllOrthologData(),
      ])

      setCachedGenes(genes)
      setDiseasePool(
        Array.from(new Set(genes.map(g => g.Ciliopathy?.trim()).filter((c): c is string => Boolean(c) && c !== 'Unknown'))).sort()
      )
      const uniqueCiliopathies = new Set(
        genes.map(g => g.Ciliopathy?.trim()).filter(c => c && c !== 'Unknown')
      ).size
      const totalPubs = publications.reduce((sum, pub) => sum + pub.publication_number, 0)
      const uniqueOrganisms = new Set(orthologs.map(o => o.Organism).filter(Boolean)).size

      setStats({
        totalGenes: genes.length,
        totalCiliopathies: uniqueCiliopathies,
        totalPublications: totalPubs,
        totalOrganisms: uniqueOrganisms,
      })
      setPublicationData(publications)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const suggestions: RichSuggestion[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return []
    const max = q.length === 1 ? 10 : 8
    const out: RichSuggestion[] = []
    const seen = new Set<string>()

    for (const gene of cachedGenes) {
      if (out.length >= max) break
      const name = gene['Human Gene Name']
      if (name?.toLowerCase().startsWith(q) && !seen.has(`g:${name}`)) {
        seen.add(`g:${name}`)
        out.push({ label: name, kind: 'gene', hint: gene.Ciliopathy })
      }
    }

    if (out.length < max) {
      for (const d of diseasePool) {
        if (out.length >= max) break
        if (d.toLowerCase().includes(q) && !seen.has(`d:${d}`)) {
          seen.add(`d:${d}`)
          out.push({ label: d, kind: 'disease' })
        }
      }
    }
    return out
  }, [debouncedQuery, cachedGenes, diseasePool])

  const handleSearch = useCallback(
    (override?: string) => {
      const q = (override ?? searchQuery).trim()
      if (q) window.location.href = `/advanced-search?q=${encodeURIComponent(q)}`
      else window.location.href = '/advanced-search'
    },
    [searchQuery]
  )

  const featureLinks = [
    {
      href: '/advanced-search',
      title: 'Gene Search',
      description: 'Query the full database with advanced filters, and export results as CSV or JSON.',
      icon: Search,
      eyebrow: 'Primary',
      stat: isDataLoading ? null : `${stats.totalGenes.toLocaleString()} genes`,
    },
    {
      href: '/ciliopathy-classification',
      title: 'Classification',
      description: 'Browse genes grouped by ciliopathy, with onset, inheritance, and phenotype data.',
      icon: Database,
      eyebrow: 'Taxonomy',
      stat: isDataLoading ? null : `${stats.totalCiliopathies} ciliopathies`,
    },
    {
      href: '/genes-orthologs',
      title: 'Orthologs',
      description: 'Cross-species conservation across model organisms including mouse, zebrafish, and C. elegans.',
      icon: Globe,
      eyebrow: 'Comparative',
      stat: isDataLoading ? null : `${stats.totalOrganisms} organisms`,
    },
    {
      href: '/symptoms-diseases',
      title: 'Clinical Features',
      description: 'Disease-phenotype associations drawn from clinical literature and OMIM.',
      icon: FileText,
      eyebrow: 'Clinical',
      stat: null,
    },
    {
      href: '/analysis',
      title: 'Data Analysis',
      description: 'Interactive visualizations: heatmaps, distributions, publication trends.',
      icon: BarChart3,
      eyebrow: 'Visualize',
      stat: null,
    },
  ]

  return (
    <Layout>
      {/* ── MASTHEAD / HERO ──────────────────────────────────────────────── */}
      <section className="relative pt-4 pb-12 md:pb-16 md:pt-8 animate-stagger-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7 xl:col-span-8">
            <p className="eyebrow mb-6 flex items-center gap-3">
              <span className="inline-block h-px w-8 bg-accent" />
              An integrated reference · v2.01 · {config.lastUpdate}
            </p>
            <h1 className="font-display text-display text-primary-800 mb-5">
              The primary literature
              <br />
              on <em className="italic text-accent">ciliopathies</em>,
              <br />
              made searchable.
            </h1>
            <p className="text-lg text-primary-500 leading-relaxed max-w-xl">
              Gene catalogues, ortholog networks, and clinical phenotype
              data for the cilium and its associated disorders — curated
              from the literature and cross-referenced with OMIM, Ensembl,
              Reactome, and KEGG.
            </p>
          </div>

          {/* Cilium — a minimal editorial ornament, not a stock illustration */}
          <div
            aria-hidden
            className="hidden lg:flex lg:col-span-5 xl:col-span-4 justify-end items-end pr-4"
          >
            <CiliumOrnament />
          </div>
        </div>

        {/* Search row */}
        <div className="mt-12 max-w-2xl">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={() => handleSearch()}
            placeholder="Search by gene symbol, Ensembl ID, or disease…"
            suggestions={suggestions}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-4">
            <span className="eyebrow">Try</span>
            {EXAMPLE_QUERIES.map((q, i) => (
              <button
                key={q}
                onClick={() => {
                  setSearchQuery(q)
                  handleSearch(q)
                }}
                className="group text-sm font-mono text-primary-600 hover:text-accent transition-colors"
              >
                <span className="underline decoration-primary-200 decoration-dotted underline-offset-4 group-hover:decoration-accent">
                  {q}
                </span>
                {i < EXAMPLE_QUERIES.length - 1 && (
                  <span className="text-primary-300 ml-3 select-none">·</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>

      <hr className="rule-ink border-t mb-12" />

      {/* ── STATS — large serif numerals, spaced like a reference index ──── */}
      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-6">
          <p className="eyebrow">The collection</p>
          <p className="text-xs text-primary-400 font-mono">
            Last reviewed {config.lastUpdate}
          </p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Genes"
            value={isDataLoading ? '—' : stats.totalGenes.toLocaleString()}
            icon={Database}
            color="blue"
            href="/advanced-search"
            description="curated entries"
          />
          <StatCard
            title="Ciliopathies"
            value={isDataLoading ? '—' : stats.totalCiliopathies.toLocaleString()}
            icon={Activity}
            color="green"
            href="/ciliopathy-classification"
            description="distinct disorders"
          />
          <StatCard
            title="Publications"
            value={isDataLoading ? '—' : stats.totalPublications.toLocaleString()}
            icon={FileText}
            color="purple"
            href="/analysis"
            description="indexed references"
          />
          <StatCard
            title="Organisms"
            value={isDataLoading ? '—' : stats.totalOrganisms.toLocaleString()}
            icon={Globe}
            color="orange"
            href="/genes-orthologs"
            description="ortholog species"
          />
        </div>
      </section>

      {/* ── SECTIONS — editorial 2-col card list ────────────────────────── */}
      <section className="mb-16">
        <div className="flex items-baseline justify-between mb-6">
          <p className="eyebrow">Explore</p>
          <p className="text-xs text-primary-400">Five entry points into the data</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {featureLinks.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`card card-hover group relative flex flex-col ${i === 0 ? 'md:col-span-2 lg:col-span-1 lg:row-span-2' : ''}`}
            >
              <div className="flex items-start justify-between mb-5">
                <p className="eyebrow">{link.eyebrow}</p>
                <ArrowUpRight className="h-4 w-4 text-primary-300 group-hover:text-accent transition-colors" />
              </div>
              <h3 className="font-display text-2xl text-primary-800 group-hover:text-accent transition-colors leading-tight mb-2">
                {link.title}
              </h3>
              <p className="text-sm text-primary-500 leading-relaxed flex-1">
                {link.description}
              </p>
              {link.stat && (
                <p className="text-xs font-mono text-primary-400 mt-5 pt-4 border-t border-primary-100">
                  {link.stat}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* ── HIGHLIGHTS — text-only editorial indexes ───────────────────── */}
      <HighlightsSection
        isLoading={isDataLoading}
        publications={publicationData}
        genes={cachedGenes}
      />
    </Layout>
  )
}

/**
 * Editorial "at a glance" highlights. Two ranked lists rendered as
 * tabular indexes — no charts. Intentionally sparse and quick to scan;
 * the full visual analysis lives on /analysis.
 */
function HighlightsSection({
  isLoading,
  publications,
  genes,
}: {
  isLoading: boolean
  publications: PublicationData[]
  genes: CiliopathyGene[]
}) {
  const topByPubs = useMemo(() => {
    const agg = new Map<string, number>()
    for (const p of publications) {
      agg.set(p.gene_name, (agg.get(p.gene_name) ?? 0) + p.publication_number)
    }
    return Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gene, count]) => ({ gene, count }))
  }, [publications])

  const topByDisease = useMemo(() => {
    const agg = new Map<string, number>()
    for (const g of genes) {
      const d = g.Ciliopathy?.trim()
      if (d && d !== 'Unknown') agg.set(d, (agg.get(d) ?? 0) + 1)
    }
    return Array.from(agg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([disease, count]) => ({ disease, count }))
  }, [genes])

  return (
    <section className="mb-16">
      <div className="flex items-baseline justify-between mb-6">
        <p className="eyebrow">At a glance</p>
        <Link href="/analysis" className="text-xs text-primary-500 hover:text-accent transition-colors">
          See full analysis →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IndexList
          eyebrow="Most-cited genes"
          note="Ranked by indexed PubMed count"
          unit="pubs"
          rows={topByPubs.map(r => ({ label: r.gene, count: r.count, mono: true, href: `/advanced-search?q=${encodeURIComponent(r.gene)}` }))}
          isLoading={isLoading}
        />
        <IndexList
          eyebrow="Most-represented disorders"
          note="Ranked by gene count"
          unit="genes"
          rows={topByDisease.map(r => ({ label: r.disease, count: r.count, mono: false, href: `/ciliopathy-classification?disease=${encodeURIComponent(r.disease)}` }))}
          isLoading={isLoading}
        />
      </div>
    </section>
  )
}

interface IndexRow {
  label: string
  count: number
  mono?: boolean
  href?: string
}

function IndexList({
  eyebrow,
  note,
  unit,
  rows,
  isLoading,
}: {
  eyebrow: string
  note: string
  unit: string
  rows: IndexRow[]
  isLoading: boolean
}) {
  return (
    <div className="card">
      <div className="flex items-baseline justify-between mb-4 gap-3">
        <p className="eyebrow">{eyebrow}</p>
        <p className="text-[11px] text-primary-400 font-mono text-right">{note}</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-6 bg-surface-muted animate-pulse rounded-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ) : (
        <ol className="divide-y divide-primary-100">
          {rows.map((r, i) => {
            const content = (
              <div className="group grid grid-cols-[2ch_1fr_auto] items-baseline gap-3 py-2">
                <span className="text-[11px] font-mono text-primary-300 tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={`truncate transition-colors group-hover:text-accent ${r.mono ? 'font-mono font-semibold text-primary-800 text-sm' : 'text-primary-700 text-sm'}`}>
                  {r.label}
                </span>
                <span className="font-mono text-[11px] text-primary-500 tabular-nums whitespace-nowrap">
                  {r.count.toLocaleString()} <span className="text-primary-300">{unit}</span>
                </span>
              </div>
            )
            return (
              <li key={r.label}>
                {r.href ? <Link href={r.href}>{content}</Link> : content}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}

// A minimal cilium ornament — an axoneme cross-section schematic
// drawn in ink, swaying gently. Not decorative noise; it belongs here.
function CiliumOrnament() {
  return (
    <svg
      width="240"
      height="240"
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-cilium-sway origin-bottom"
    >
      {/* outer ring — plasma membrane */}
      <circle cx="120" cy="120" r="96" stroke="#1C2631" strokeWidth="0.75" opacity="0.35" />
      <circle cx="120" cy="120" r="96" stroke="#1C2631" strokeWidth="0.75" strokeDasharray="2 3" opacity="0.5" />

      {/* 9 outer doublets — arranged in a 9+2 axoneme pattern */}
      {Array.from({ length: 9 }).map((_, i) => {
        const angle = (i / 9) * Math.PI * 2 - Math.PI / 2
        const x = 120 + Math.cos(angle) * 72
        const y = 120 + Math.sin(angle) * 72
        return (
          <g key={i}>
            <circle cx={x - 4} cy={y} r="5" fill="#1C2631" opacity="0.85" />
            <circle cx={x + 4} cy={y} r="5" fill="#1C2631" opacity="0.85" />
            {/* radial spokes */}
            <line
              x1="120"
              y1="120"
              x2={x}
              y2={y}
              stroke="#1C2631"
              strokeWidth="0.5"
              opacity="0.3"
              strokeDasharray="1 2"
            />
          </g>
        )
      })}

      {/* central pair */}
      <circle cx="112" cy="120" r="5" fill="#8B2635" />
      <circle cx="128" cy="120" r="5" fill="#8B2635" />
      <line x1="112" y1="120" x2="128" y2="120" stroke="#8B2635" strokeWidth="0.5" opacity="0.4" />

      {/* annotation */}
      <text
        x="120"
        y="228"
        textAnchor="middle"
        fontSize="9"
        fill="#6B7687"
        fontFamily="var(--font-mono)"
        letterSpacing="0.1em"
      >
        AXONEME · 9+2
      </text>
    </svg>
  )
}
