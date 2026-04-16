'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Layout from '@/components/Layout'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SearchInput, OrthologResults } from '@/components/SearchComponents'
import type { RichSuggestion } from '@/components/SearchComponents'
import { OrthologGene } from '@/types'
import { dataService } from '@/services/dataService'
import { useDebounce } from '@/lib/utils'
import { useUrlState } from '@/lib/urlState'
import { downloadAs } from '@/lib/download'
import { Globe, Database, Mouse, Fish, Zap, Bug, Circle, Leaf } from 'lucide-react'

const ORGANISMS = [
  { id: 'all', name: 'All organisms', commonName: 'All', icon: Globe },
  { id: 'mus_musculus', name: 'Mus musculus', commonName: 'Mouse', icon: Mouse },
  { id: 'danio_rerio', name: 'Danio rerio', commonName: 'Zebrafish', icon: Fish },
  { id: 'xenopus_laevis', name: 'Xenopus laevis', commonName: 'Frog', icon: Zap },
  { id: 'drosophila_melanogaster', name: 'Drosophila melanogaster', commonName: 'Fruit fly', icon: Bug },
  { id: 'caenorhabditis_elegans', name: 'Caenorhabditis elegans', commonName: 'Worm', icon: Circle },
  { id: 'chlamydomonas_reinhardtii', name: 'Chlamydomonas reinhardtii', commonName: 'Green algae', icon: Leaf },
] as const

const VALID_ORGANISMS = ORGANISMS.map(o => o.id)

export default function OrthologsPage() {
  return (
    <Suspense fallback={<Layout><div className="py-20 text-center text-primary-400 text-sm">Loading…</div></Layout>}>
      <ErrorBoundary scope="orthologs">
        <PageInner />
      </ErrorBoundary>
    </Suspense>
  )
}

function PageInner() {
  const [selectedOrganism, setSelectedOrganism] = useUrlState('org', 'all')
  const [urlQuery, setUrlQuery] = useUrlState('q', '')

  const activeOrganism = VALID_ORGANISMS.includes(selectedOrganism as any) ? selectedOrganism : 'all'
  const selectedMeta = ORGANISMS.find(o => o.id === activeOrganism) ?? ORGANISMS[0]

  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [searchResults, setSearchResults] = useState<OrthologGene[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedOrganismData, setSelectedOrganismData] = useState<OrthologGene[]>([])
  const [isLoadingOrganismData, setIsLoadingOrganismData] = useState(false)
  const [organismStats, setOrganismStats] = useState<Record<string, number>>({})
  const [totalOrthologs, setTotalOrthologs] = useState(0)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [cachedGeneNames, setCachedGeneNames] = useState<string[]>([])

  const debouncedQuery = useDebounce(searchQuery, 300)

  // Sync local query → URL when the user submits.
  const pushQueryToUrl = useCallback((q: string) => setUrlQuery(q), [setUrlQuery])

  // Load organism stats + gene-name cache (for suggestions).
  useEffect(() => {
    let cancelled = false
    setIsLoadingStats(true)
    Promise.all([
      Promise.all(
        ORGANISMS.filter(o => o.id !== 'all').map(org =>
          dataService.getOrganismStats(org.id).then(s => [org.id, s.geneCount] as const).catch(() => [org.id, 0] as const)
        )
      ),
      dataService.getCiliopathyGenes().then(genes =>
        Array.from(new Set(genes.map(g => g['Human Gene Name']).filter((n): n is string => Boolean(n)))).sort()
      ).catch(() => [] as string[]),
    ])
      .then(([stats, geneNames]) => {
        if (cancelled) return
        const statsMap = Object.fromEntries(stats)
        setOrganismStats(statsMap)
        setTotalOrthologs(Object.values(statsMap).reduce((sum, n) => sum + n, 0))
        setCachedGeneNames(geneNames)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStats(false)
      })
    return () => { cancelled = true }
  }, [])

  // Load per-organism data when a specific organism is selected.
  useEffect(() => {
    if (activeOrganism === 'all') {
      setSelectedOrganismData([])
      return
    }
    let cancelled = false
    setIsLoadingOrganismData(true)
    dataService.getOrthologData(activeOrganism)
      .then(data => { if (!cancelled) setSelectedOrganismData(data) })
      .catch(() => { if (!cancelled) setSelectedOrganismData([]) })
      .finally(() => { if (!cancelled) setIsLoadingOrganismData(false) })
    return () => { cancelled = true }
  }, [activeOrganism])

  const suggestions: RichSuggestion[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q || cachedGeneNames.length === 0) return []
    const max = q.length === 1 ? 10 : 8
    return cachedGeneNames
      .filter(n => n.toLowerCase().startsWith(q))
      .slice(0, max)
      .map(label => ({ label, kind: 'gene' as const }))
  }, [debouncedQuery, cachedGeneNames])

  const runSearch = useCallback(async (q: string) => {
    const query = q.trim().toLowerCase()
    if (!query) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const organismIds = activeOrganism === 'all'
        ? ORGANISMS.filter(o => o.id !== 'all').map(o => o.id)
        : [activeOrganism]

      const results: OrthologGene[] = []
      for (const org of organismIds) {
        try {
          const orthologs = await dataService.getOrthologData(org)
          results.push(...orthologs.filter(o =>
            o['Human Gene Name']?.toLowerCase().includes(query) ||
            o['Ortholog Gene Name']?.toLowerCase().includes(query)
          ))
        } catch {
          // skip failed organism
        }
      }
      setSearchResults(results)
    } catch (err) {
      console.error('Ortholog search failed:', err)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [activeOrganism])

  // Consume ?q= whenever it changes.
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery)
      runSearch(urlQuery)
    } else {
      setSearchResults([])
    }
  }, [urlQuery, runSearch])

  const handleSearch = useCallback((override?: string) => {
    const q = (override ?? searchQuery).trim()
    pushQueryToUrl(q)
  }, [searchQuery, pushQueryToUrl])

  const handleDownload = useCallback((format: 'csv' | 'json') => {
    const data = searchResults.length > 0 ? searchResults : selectedOrganismData
    if (data.length === 0) return
    const scope = searchResults.length > 0
      ? `ortholog_search_${urlQuery || 'all'}`
      : `orthologs_${activeOrganism}`
    downloadAs(format, data as unknown as Record<string, unknown>[], scope)
  }, [searchResults, selectedOrganismData, urlQuery, activeOrganism])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    pushQueryToUrl('')
  }, [pushQueryToUrl])

  return (
    <Layout>
      <Breadcrumbs
        trail={[
          { label: 'Orthologs', href: '/genes-orthologs' },
          ...(activeOrganism !== 'all' ? [{ label: selectedMeta.commonName }] : []),
        ]}
      />

      <div className="space-y-8 max-w-5xl mx-auto">
        <header className="pt-2">
          <p className="eyebrow mb-3">
            <span className="inline-block h-px w-6 bg-accent align-middle mr-2" />
            Orthologs
          </p>
          <h1 className="font-display text-title text-primary-800 mb-2">
            Conservation across model organisms.
          </h1>
          <p className="text-sm text-primary-500 max-w-xl">
            {!isLoadingStats && (
              <>
                <span className="font-mono text-primary-700">{totalOrthologs.toLocaleString()}</span> orthologs
                indexed across {ORGANISMS.length - 1} organisms.
              </>
            )}
          </p>
        </header>

        {/* Organism tiles */}
        <div className="card">
          <p className="eyebrow mb-4">Filter by organism</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            {ORGANISMS.map((org) => {
              const Icon = org.icon
              const isSelected = activeOrganism === org.id
              const count = org.id === 'all' ? totalOrthologs : (organismStats[org.id] ?? 0)
              return (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrganism(org.id === 'all' ? '' : org.id)}
                  className={`p-3 rounded-sm border text-left transition-colors ${
                    isSelected
                      ? 'border-accent bg-surface'
                      : 'border-primary-100 hover:border-primary-300 bg-surface/50'
                  }`}
                >
                  <Icon className={`h-4 w-4 mb-2 ${isSelected ? 'text-accent' : 'text-primary-400'}`} />
                  <div className={`text-xs font-semibold leading-tight ${isSelected ? 'text-accent' : 'text-primary-800'}`}>
                    {org.commonName}
                  </div>
                  {org.id !== 'all' && (
                    <div className="text-[10px] italic text-primary-400 leading-tight mt-0.5">
                      {org.name}
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-primary-500 mt-1.5">
                    {count.toLocaleString()}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search */}
        <div className="card">
          <p className="eyebrow mb-3">
            Search {activeOrganism !== 'all' ? <span className="normal-case tracking-normal italic">in {selectedMeta.name}</span> : 'orthologs'}
          </p>
          <SearchInput
            placeholder="Search by human gene name or ortholog gene name…"
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={(q) => handleSearch(q)}
            isLoading={isSearching}
            suggestions={suggestions}
            listboxId="ortholog-suggestions"
          />
        </div>

        {isSearching && (
          <div className="card py-8 text-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-primary-400 font-mono">Searching orthologs…</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <OrthologResults
            results={searchResults}
            onDownload={handleDownload}
            onClear={handleClearSearch}
          />
        )}

        {!isSearching && urlQuery && searchResults.length === 0 && (
          <EmptyState
            icon={Database}
            title="No orthologs match that query."
            hint="Try a different gene name or select a different organism."
          />
        )}

        {!urlQuery && activeOrganism !== 'all' && (
          <>
            {isLoadingOrganismData && (
              <div className="card py-8 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mx-auto mb-3" />
                <p className="text-sm text-primary-400 font-mono">Loading {selectedMeta.name}…</p>
              </div>
            )}

            {!isLoadingOrganismData && selectedOrganismData.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <p className="eyebrow">
                    <em className="italic font-normal normal-case tracking-normal text-primary-700">{selectedMeta.name}</em>
                    <span className="mx-2 text-primary-300">·</span>
                    {selectedOrganismData.length.toLocaleString()} orthologs
                  </p>
                </div>
                <OrthologResults
                  results={selectedOrganismData}
                  onDownload={handleDownload}
                />
              </div>
            )}

            {!isLoadingOrganismData && selectedOrganismData.length === 0 && (
              <EmptyState
                icon={Database}
                title={`No data for ${selectedMeta.name} yet.`}
                hint="This organism's column has not been added to the source workbook."
              />
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
