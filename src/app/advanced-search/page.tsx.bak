'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react'
import Layout from '@/components/Layout'
import { SearchInput } from '@/components/SearchComponents'
import type { RichSuggestion } from '@/components/SearchComponents'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { dataService } from '@/services/dataService'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'
import { useDebounce } from '@/lib/utils'
import { useUrlState, useUrlNumberState, useUrlStateBatch } from '@/lib/urlState'
import { downloadAs, downloadMultiSectionCsv } from '@/lib/download'
import { Search, Download, ChevronDown, X, Link2 } from 'lucide-react'

type SearchType = 'all' | 'gene' | 'disease' | 'ortholog'
const DATASET_OPTIONS: { value: SearchType; label: string }[] = [
  { value: 'all', label: 'All datasets' },
  { value: 'gene', label: 'Genes only' },
  { value: 'disease', label: 'Diseases only' },
  { value: 'ortholog', label: 'Orthologs only' },
]

interface MultiResults {
  genes: CiliopathyGene[]
  features: CiliopathyFeature[]
  orthologs: OrthologGene[]
  totalResults: number
}

const EMPTY_RESULTS: MultiResults = { genes: [], features: [], orthologs: [], totalResults: 0 }

const ITEMS_PER_PAGE = 25

const TRY_QUERIES = ['BBS1', 'CEP290', 'PKD1', 'IFT88', 'Joubert', 'Bardet-Biedl']

// ─────────────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense fallback={<Layout><div className="py-20 text-center text-primary-400 text-sm">Loading…</div></Layout>}>
      <ErrorBoundary scope="search">
        <SearchPageInner />
      </ErrorBoundary>
    </Suspense>
  )
}

function SearchPageInner() {
  // ── URL-synced state — every filter is in the query string ──────────────
  const [urlQuery, setUrlQuery] = useUrlState('q', '')
  const [searchType, setSearchType] = useUrlState<SearchType>('type', 'all')
  const [disease, setDisease] = useUrlState('disease', '')
  const [organism, setOrganism] = useUrlState('organism', '')
  const [localization, setLocalization] = useUrlState('loc', '')
  const [symptom, setSymptom] = useUrlState('symptom', '')
  const [genesPage, setGenesPage] = useUrlNumberState('gp', 1)
  const [featuresPage, setFeaturesPage] = useUrlNumberState('fp', 1)
  const [orthologsPage, setOrthologsPage] = useUrlNumberState('op', 1)
  const batchUpdate = useUrlStateBatch()

  const hasAnyFilter = Boolean(
    disease || organism || localization || symptom || searchType !== 'all'
  )

  // ── Local state ─────────────────────────────────────────────────────────
  const [query, setQuery] = useState(urlQuery)
  const debouncedInput = useDebounce(query, 300)
  const [cachedGenes, setCachedGenes] = useState<CiliopathyGene[]>([])
  const [cachedFeatures, setCachedFeatures] = useState<CiliopathyFeature[]>([])
  const [cachedOrthologs, setCachedOrthologs] = useState<OrthologGene[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [results, setResults] = useState<MultiResults>(EMPTY_RESULTS)
  const [isSearching, setIsSearching] = useState(false)
  const [copied, setCopied] = useState(false)

  // ── Load all datasets once ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([
      dataService.getCiliopathyGenes(),
      dataService.getCiliopathyFeatures(),
      dataService.getAllOrthologData(),
    ])
      .then(([genes, features, orthologs]) => {
        if (cancelled) return
        setCachedGenes(genes)
        setCachedFeatures(features)
        setCachedOrthologs(orthologs)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load data:', err)
        setLoadError(err instanceof Error ? err.message : 'Unable to load database')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ── Derived filter options (memoized once data loads) ───────────────────
  const filterOptions = useMemo(() => ({
    diseases: Array.from(new Set(cachedGenes.map(g => g.Ciliopathy).filter(Boolean))).sort(),
    symptoms: Array.from(new Set(cachedFeatures.map(f => f.Category).filter((c): c is string => Boolean(c)))).sort(),
    organisms: Array.from(new Set(cachedOrthologs.map(o => o.Organism).filter(Boolean))).sort(),
    localizations: Array.from(new Set(cachedGenes.map(g => g['Subcellular Localization']).filter((l): l is string => Boolean(l)))).sort(),
  }), [cachedGenes, cachedFeatures, cachedOrthologs])

  // ── Multi-type autocomplete (genes + diseases) ──────────────────────────
  const suggestions: RichSuggestion[] = useMemo(() => {
    const q = debouncedInput.trim().toLowerCase()
    if (!q) return []
    const max = q.length === 1 ? 10 : 8
    const seen = new Set<string>()
    const out: RichSuggestion[] = []

    for (const g of cachedGenes) {
      if (out.length >= max) break
      const name = g['Human Gene Name']
      if (name && name.toLowerCase().startsWith(q) && !seen.has(`g:${name}`)) {
        seen.add(`g:${name}`)
        out.push({ label: name, kind: 'gene', hint: g.Ciliopathy })
      }
    }
    if (out.length < max) {
      for (const d of filterOptions.diseases) {
        if (out.length >= max) break
        if (d.toLowerCase().includes(q) && !seen.has(`d:${d}`)) {
          seen.add(`d:${d}`)
          out.push({ label: d, kind: 'disease' })
        }
      }
    }
    return out
  }, [debouncedInput, cachedGenes, filterOptions.diseases])

  // ── The one search function ─────────────────────────────────────────────
  const runSearch = useCallback(() => {
    if (isLoading) return
    const hasQuery = urlQuery.trim().length > 0

    // If nothing is set, clear results.
    if (!hasQuery && !hasAnyFilter) {
      setResults(EMPTY_RESULTS)
      return
    }

    setIsSearching(true)
    try {
      let genes: CiliopathyGene[] = []
      let features: CiliopathyFeature[] = []
      let orthologs: OrthologGene[] = []

      if (searchType === 'all' || searchType === 'gene') genes = [...cachedGenes]
      if (searchType === 'all' || searchType === 'disease') features = [...cachedFeatures]
      if (searchType === 'all' || searchType === 'ortholog') orthologs = [...cachedOrthologs]

      const q = urlQuery.trim().toLowerCase()
      if (q) {
        genes = genes.filter(g =>
          g['Human Gene Name']?.toLowerCase().includes(q) ||
          g.Ciliopathy?.toLowerCase().includes(q) ||
          g['Gene MIM Number']?.toLowerCase().includes(q) ||
          g['Human Gene ID']?.toLowerCase().includes(q)
        )
        features = features.filter(f =>
          f.Disease?.toLowerCase().includes(q) ||
          f['Ciliopathy / Clinical Features']?.toLowerCase().includes(q)
        )
        orthologs = orthologs.filter(o =>
          o['Human Gene Name']?.toLowerCase().includes(q) ||
          o['Ortholog Gene Name']?.toLowerCase().includes(q)
        )
      }

      if (disease) {
        const d = disease.toLowerCase()
        genes = genes.filter(g => g.Ciliopathy?.toLowerCase().includes(d))
        features = features.filter(f =>
          f.Disease?.toLowerCase().includes(d) || f.Ciliopathy?.toLowerCase().includes(d)
        )
        orthologs = orthologs.filter(o => o['Human Disease']?.toLowerCase().includes(d))
      }
      if (symptom) {
        features = features.filter(f => f.Category?.toLowerCase().includes(symptom.toLowerCase()))
      }
      if (organism) {
        orthologs = orthologs.filter(o => o.Organism?.toLowerCase().includes(organism.toLowerCase()))
      }
      if (localization) {
        genes = genes.filter(g => g['Subcellular Localization']?.toLowerCase().includes(localization.toLowerCase()))
      }

      setResults({
        genes, features, orthologs,
        totalResults: genes.length + features.length + orthologs.length,
      })
    } catch (err) {
      console.error('Search failed:', err)
      setResults(EMPTY_RESULTS)
    } finally {
      setIsSearching(false)
    }
  }, [isLoading, urlQuery, searchType, disease, organism, localization, symptom, cachedGenes, cachedFeatures, cachedOrthologs, hasAnyFilter])

  // Re-run search whenever URL-synced state changes (or data finishes loading).
  useEffect(() => {
    runSearch()
  }, [runSearch])

  // Keep the input in sync when URL changes externally (e.g. clicking a "Try" chip).
  useEffect(() => {
    setQuery(urlQuery)
  }, [urlQuery])

  const commitQuery = useCallback((value: string) => {
    batchUpdate({ q: value.trim() || null, gp: null, fp: null, op: null })
  }, [batchUpdate])

  const clearAllFilters = () => {
    batchUpdate({
      q: null, type: null, disease: null, organism: null, loc: null, symptom: null,
      gp: null, fp: null, op: null,
    })
    setQuery('')
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable — fall back silently.
    }
  }

  const handleDownload = (format: 'csv' | 'json') => {
    const scope = `search_${urlQuery || 'filtered'}`
    if (format === 'json') {
      downloadAs('json', [results as unknown as Record<string, unknown>], scope)
      return
    }
    downloadMultiSectionCsv(
      [
        {
          title: 'Genes',
          rows: results.genes.map(g => ({
            'Gene Name': g['Human Gene Name'],
            Ciliopathy: g.Ciliopathy,
            Localization: g['Subcellular Localization'],
            'MIM Number': g['Gene MIM Number'],
          })),
        },
        {
          title: 'Clinical Features',
          rows: results.features.map(f => ({
            Disease: f.Disease || f.Ciliopathy,
            Feature: f['Ciliopathy / Clinical Features'] || f.Feature,
            Category: f.Category,
          })),
        },
        {
          title: 'Orthologs',
          rows: results.orthologs.map(o => ({
            'Human Gene': o['Human Gene Name'],
            'Ortholog Gene': o['Ortholog Gene Name'],
            Organism: o.Organism,
          })),
        },
      ],
      scope
    )
  }

  const showingResults = results.totalResults > 0
  const isActive = urlQuery.trim().length > 0 || hasAnyFilter

  return (
    <Layout>
      <Breadcrumbs trail={[{ label: 'Search' }]} />

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <header className="pt-2">
          <p className="eyebrow mb-3">
            <span className="inline-block h-px w-6 bg-accent align-middle mr-2" />
            Search
          </p>
          <h1 className="font-display text-title text-primary-800 mb-2">
            Query the database.
          </h1>
          <p className="text-sm text-primary-500 max-w-xl">
            One input, one set of filters. Everything you pick is reflected
            in the URL — bookmark the link to preserve the exact view.
          </p>
        </header>

        {loadError && (
          <EmptyState
            icon={Search}
            title="Database failed to load"
            hint={<span className="font-mono text-[11px]">{loadError}</span>}
          />
        )}

        {/* ── UNIFIED SEARCH BLOCK ───────────────────────────────────── */}
        <section className="card space-y-4">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSearch={(q) => commitQuery(q ?? query)}
            placeholder="Gene symbol, disease name, Ensembl ID, MIM number…"
            isLoading={isSearching}
            suggestions={suggestions}
            listboxId="unified-search-suggestions"
          />

          {/* TRY examples */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="eyebrow">Try</span>
            {TRY_QUERIES.map((q, i) => (
              <React.Fragment key={q}>
                <button
                  onClick={() => {
                    setQuery(q)
                    commitQuery(q)
                  }}
                  className="font-mono text-xs text-primary-600 hover:text-accent transition-colors underline decoration-primary-200 decoration-dotted underline-offset-4 hover:decoration-accent"
                >
                  {q}
                </button>
                {i < TRY_QUERIES.length - 1 && (
                  <span aria-hidden className="text-primary-300 select-none">·</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {/* FILTER PILLS */}
          <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-primary-100">
            <span className="eyebrow mr-1">Filtering</span>

            <FilterPill
              label="dataset"
              activeLabel={
                searchType !== 'all'
                  ? (DATASET_OPTIONS.find(o => o.value === searchType)?.label ?? null)
                  : null
              }
              onClear={() => setSearchType('all')}
            >
              {({ close }) => (
                <div className="p-1">
                  {DATASET_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setSearchType(opt.value); close() }}
                      className={`block w-full text-left px-3 py-2 text-sm rounded-sm transition-colors ${
                        searchType === opt.value
                          ? 'bg-surface-muted text-accent font-medium'
                          : 'text-primary-700 hover:bg-surface-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </FilterPill>

            <FilterPill
              label="disease"
              activeLabel={disease || null}
              onClear={() => setDisease('')}
            >
              {({ close }) => (
                <FilterList
                  options={filterOptions.diseases}
                  selected={disease}
                  onPick={(v) => { setDisease(v); close() }}
                />
              )}
            </FilterPill>

            <FilterPill
              label="organism"
              activeLabel={organism || null}
              onClear={() => setOrganism('')}
            >
              {({ close }) => (
                <FilterList
                  options={filterOptions.organisms}
                  selected={organism}
                  onPick={(v) => { setOrganism(v); close() }}
                />
              )}
            </FilterPill>

            <FilterPill
              label="localization"
              activeLabel={localization || null}
              onClear={() => setLocalization('')}
            >
              {({ close }) => (
                <FilterList
                  options={filterOptions.localizations}
                  selected={localization}
                  onPick={(v) => { setLocalization(v); close() }}
                />
              )}
            </FilterPill>

            <FilterPill
              label="symptom"
              activeLabel={symptom || null}
              onClear={() => setSymptom('')}
            >
              {({ close }) => (
                <FilterList
                  options={filterOptions.symptoms}
                  selected={symptom}
                  onPick={(v) => { setSymptom(v); close() }}
                />
              )}
            </FilterPill>

            {isActive && (
              <button
                onClick={clearAllFilters}
                className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] text-primary-400 hover:text-accent transition-colors"
              >
                Reset all
              </button>
            )}
          </div>

          {/* STATUS STRIP */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-primary-100 text-[11px] font-mono">
            <span className="text-primary-400">
              {cachedGenes.length.toLocaleString()} genes
              <span className="mx-2 text-primary-200">·</span>
              {filterOptions.diseases.length.toLocaleString()} diseases
              <span className="mx-2 text-primary-200">·</span>
              {filterOptions.organisms.length.toLocaleString()} organisms indexed
            </span>
            <button
              onClick={copyShareLink}
              disabled={!isActive}
              className="inline-flex items-center gap-1.5 text-primary-500 hover:text-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title={isActive ? 'Copy shareable link' : 'Set a query or filter first'}
            >
              <Link2 className="h-3 w-3" />
              {copied ? 'link copied' : 'copy link to this view'}
            </button>
          </div>
        </section>

        {/* ── RESULTS ─────────────────────────────────────────────────── */}
        {isSearching && !showingResults && (
          <div className="card py-8 text-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-primary-400 font-mono">Searching…</p>
          </div>
        )}

        {!isSearching && !isActive && (
          <div className="py-8 text-center text-sm text-primary-400">
            Type a query above or pick a filter to begin.
          </div>
        )}

        {!isSearching && isActive && !showingResults && (
          <EmptyState
            icon={Search}
            title="No matches for this combination."
            hint="Relax one of the filters or try a different query. The URL records everything — use your browser's back button to undo."
          />
        )}

        {showingResults && (
          <div className="card">
            <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
              <h2 className="eyebrow">
                {results.totalResults.toLocaleString()} result{results.totalResults === 1 ? '' : 's'}
                {results.genes.length > 0 && <span className="mx-2 text-primary-300">·</span>}
                {results.genes.length > 0 && (
                  <span className="text-primary-500 font-normal">
                    {results.genes.length} gene{results.genes.length === 1 ? '' : 's'}
                  </span>
                )}
                {results.features.length > 0 && <span className="mx-2 text-primary-300">·</span>}
                {results.features.length > 0 && (
                  <span className="text-primary-500 font-normal">
                    {results.features.length} feature{results.features.length === 1 ? '' : 's'}
                  </span>
                )}
                {results.orthologs.length > 0 && <span className="mx-2 text-primary-300">·</span>}
                {results.orthologs.length > 0 && (
                  <span className="text-primary-500 font-normal">
                    {results.orthologs.length} ortholog{results.orthologs.length === 1 ? '' : 's'}
                  </span>
                )}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => handleDownload('csv')} className="btn-secondary text-xs">
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button onClick={() => handleDownload('json')} className="btn-secondary text-xs">
                  <Download className="h-3.5 w-3.5" /> JSON
                </button>
              </div>
            </div>

            {results.genes.length > 0 && (
              <div className="mb-6">
                <h3 className="eyebrow mb-3">Genes · {results.genes.length.toLocaleString()}</h3>
                <ResultsTable
                  columns={[
                    { label: 'Gene', render: (g: CiliopathyGene) => <span className="font-mono font-semibold text-primary-800">{g['Human Gene Name']}</span> },
                    { label: 'Ciliopathy', render: (g: CiliopathyGene) => g.Ciliopathy },
                    { label: 'Localization', render: (g: CiliopathyGene) => g['Subcellular Localization'] || '—' },
                  ]}
                  rows={results.genes.slice((genesPage - 1) * ITEMS_PER_PAGE, genesPage * ITEMS_PER_PAGE)}
                />
                <Pagination currentPage={genesPage} totalItems={results.genes.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setGenesPage} />
              </div>
            )}

            {results.features.length > 0 && (
              <div className="mb-6">
                <h3 className="eyebrow mb-3">Clinical features · {results.features.length.toLocaleString()}</h3>
                <ResultsTable
                  columns={[
                    { label: 'Disease', render: (f: CiliopathyFeature) => f.Disease || f.Ciliopathy || '—' },
                    { label: 'Feature', render: (f: CiliopathyFeature) => f['Ciliopathy / Clinical Features'] || f.Feature || '—' },
                    { label: 'Category', render: (f: CiliopathyFeature) => f.Category || '—' },
                  ]}
                  rows={results.features.slice((featuresPage - 1) * ITEMS_PER_PAGE, featuresPage * ITEMS_PER_PAGE)}
                />
                <Pagination currentPage={featuresPage} totalItems={results.features.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setFeaturesPage} />
              </div>
            )}

            {results.orthologs.length > 0 && (
              <div>
                <h3 className="eyebrow mb-3">Orthologs · {results.orthologs.length.toLocaleString()}</h3>
                <ResultsTable
                  columns={[
                    { label: 'Human Gene', render: (o: OrthologGene) => <span className="font-mono font-semibold text-primary-800">{o['Human Gene Name']}</span> },
                    { label: 'Ortholog Gene', render: (o: OrthologGene) => <span className="font-mono text-primary-700">{o['Ortholog Gene Name']}</span> },
                    { label: 'Organism', render: (o: OrthologGene) => <em className="italic">{o.Organism}</em> },
                  ]}
                  rows={results.orthologs.slice((orthologsPage - 1) * ITEMS_PER_PAGE, orthologsPage * ITEMS_PER_PAGE)}
                />
                <Pagination currentPage={orthologsPage} totalItems={results.orthologs.length} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setOrthologsPage} />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

// ─── FilterPill: a chip + popover ────────────────────────────────────────────

interface FilterPillProps {
  label: string
  activeLabel: string | null
  onClear: () => void
  children: (ctx: { close: () => void }) => React.ReactNode
}

function FilterPill({ label, activeLabel, onClear, children }: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const isActive = Boolean(activeLabel)

  return (
    <div ref={ref} className="relative">
      <div className={`inline-flex items-stretch rounded-sm overflow-hidden border transition-colors ${
        isActive ? 'border-accent bg-accent/5' : 'border-primary-200 hover:border-primary-400'
      }`}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium transition-colors ${
            isActive ? 'text-accent' : 'text-primary-600'
          }`}
        >
          <span className="uppercase tracking-[0.1em] text-[10px]">{label}</span>
          <span className={isActive ? 'text-accent font-normal' : 'text-primary-400 font-normal'}>
            {activeLabel ? truncate(activeLabel, 22) : 'any'}
          </span>
          <ChevronDown className="h-3 w-3" />
        </button>
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); setOpen(false) }}
            className="pl-1.5 pr-2 text-accent/60 hover:text-accent border-l border-accent/30 transition-colors"
            aria-label={`Clear ${label} filter`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-40 min-w-[18rem] max-w-[22rem] bg-surface border border-primary-200 rounded-sm shadow-lg shadow-primary-800/5 overflow-hidden">
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s
}

// ─── FilterList: a filterable list inside a pill's popover ───────────────────

function FilterList({
  options,
  selected,
  onPick,
}: {
  options: string[]
  selected: string
  onPick: (value: string) => void
}) {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return options.slice(0, 200)
    return options.filter(o => o.toLowerCase().includes(needle)).slice(0, 200)
  }, [q, options])

  return (
    <div className="flex flex-col max-h-80">
      <div className="px-3 py-2 border-b border-primary-100">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Filter ${options.length} options…`}
          autoFocus
          className="w-full bg-transparent text-sm text-primary-800 placeholder:text-primary-300 focus:outline-none"
        />
      </div>
      <div className="overflow-y-auto py-1">
        <button
          onClick={() => onPick('')}
          className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
            !selected ? 'text-accent font-medium bg-surface-muted' : 'text-primary-500 hover:bg-surface-muted'
          }`}
        >
          Any
        </button>
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-primary-400 italic">No matches.</p>
        ) : (
          filtered.map(opt => (
            <button
              key={opt}
              onClick={() => onPick(opt)}
              className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
                selected === opt
                  ? 'text-accent font-medium bg-surface-muted'
                  : 'text-primary-700 hover:bg-surface-muted'
              }`}
              title={opt}
            >
              <span className="block truncate">{opt}</span>
            </button>
          ))
        )}
      </div>
      {options.length > 200 && !q && (
        <p className="px-3 py-1.5 text-[10px] text-primary-400 font-mono border-t border-primary-100">
          Showing first 200 · type to filter the rest
        </p>
      )}
    </div>
  )
}

// ─── Pagination + ResultsTable ───────────────────────────────────────────────

function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between mt-3">
      <p className="text-xs text-primary-400 font-mono">
        {start.toLocaleString()}–{end.toLocaleString()} of {totalItems.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
        >
          Previous
        </button>
        <span className="text-xs text-primary-500 font-mono">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}

interface Column<T> {
  label: string
  render: (row: T) => React.ReactNode
}

function ResultsTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="overflow-auto rounded-sm border border-primary-100" style={{ maxHeight: '50vh' }}>
      <table className="min-w-full divide-y divide-primary-100">
        <thead className="bg-surface-muted sticky top-0 z-10">
          <tr>
            {columns.map(col => (
              <th key={col.label} scope="col" className="px-4 py-3 text-left eyebrow whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-surface divide-y divide-primary-50">
          {rows.map((row, idx) => (
            <tr key={idx} className="hover:bg-surface-muted transition-colors">
              {columns.map(col => (
                <td key={col.label} className="px-4 py-2.5 text-xs text-primary-700">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
