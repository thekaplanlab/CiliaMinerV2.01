'use client'

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
import Layout from '@/components/Layout'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SearchInput, SearchResults } from '@/components/SearchComponents'
import type { RichSuggestion } from '@/components/SearchComponents'
import { CiliopathyFeature } from '@/types'
import { dataService } from '@/services/dataService'
import { useDebounce } from '@/lib/utils'
import { useUrlState, useUrlStateBatch } from '@/lib/urlState'
import { downloadAs } from '@/lib/download'
import { Search, Activity } from 'lucide-react'

type Mode = 'disease' | 'symptom'

export default function SymptomsDiseasesPage() {
  return (
    <Suspense fallback={<Layout><div className="py-20 text-center text-primary-400 text-sm">Loading…</div></Layout>}>
      <ErrorBoundary scope="symptoms-diseases">
        <PageInner />
      </ErrorBoundary>
    </Suspense>
  )
}

function PageInner() {
  const [modeRaw, setMode] = useUrlState<Mode>('mode', 'disease')
  const mode: Mode = modeRaw === 'symptom' ? 'symptom' : 'disease'
  const [urlQuery, setUrlQuery] = useUrlState('q', '')
  const [selectedDisease, setSelectedDisease] = useUrlState('disease', '')
  const batchUpdate = useUrlStateBatch()

  const [searchQuery, setSearchQuery] = useState(urlQuery)
  const [searchResults, setSearchResults] = useState<CiliopathyFeature[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [features, setFeatures] = useState<CiliopathyFeature[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const debouncedQuery = useDebounce(searchQuery, 300)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    dataService.getCiliopathyFeatures()
      .then(data => { if (!cancelled) setFeatures(data) })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load features:', err)
        setLoadError(err instanceof Error ? err.message : 'Unable to load data')
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  const { availableDiseases, clinicalFeatures, topFeaturesData, categoryCount } = useMemo(() => {
    const diseases = Array.from(new Set(
      features.map(f => f.Disease).filter((d): d is string => Boolean(d))
    )).sort()
    const feats = Array.from(new Set(
      features.map(f => f['Ciliopathy / Clinical Features']).filter((f): f is string => Boolean(f))
    )).sort()

    const counts = new Map<string, { count: number; category: string }>()
    for (const f of features) {
      const name = f['Ciliopathy / Clinical Features']
      const category = f.Category || f['General Titles'] || 'Other'
      if (!name) continue
      const existing = counts.get(name)
      if (existing) existing.count++
      else counts.set(name, { count: 1, category })
    }
    const top = Array.from(counts.entries())
      .map(([feature, d]) => ({ feature, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    const cats = new Set(top.map(f => f.category))
    return {
      availableDiseases: diseases,
      clinicalFeatures: feats,
      topFeaturesData: top,
      categoryCount: cats.size,
    }
  }, [features])

  // Disease-dropdown → filter results.
  useEffect(() => {
    if (!selectedDisease || mode !== 'disease') return
    setSearchResults(features.filter(f => f.Disease === selectedDisease))
  }, [selectedDisease, mode, features])

  // Text search (driven by URL).
  const runSearch = useCallback((q: string, currentMode: Mode) => {
    const query = q.trim().toLowerCase()
    if (!query) {
      if (!selectedDisease) setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const results = currentMode === 'disease'
        ? features.filter(f => f.Disease?.toLowerCase().includes(query))
        : features.filter(f => f['Ciliopathy / Clinical Features']?.toLowerCase().includes(query))
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }, [features, selectedDisease])

  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery)
      runSearch(urlQuery, mode)
    }
  }, [urlQuery, mode, runSearch])

  const suggestions: RichSuggestion[] = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    if (!q) return []
    const max = q.length === 1 ? 10 : 8
    const pool = mode === 'disease' ? availableDiseases : clinicalFeatures
    return pool
      .filter(item => item.toLowerCase().startsWith(q))
      .slice(0, max)
      .map(label => ({
        label,
        kind: mode === 'disease' ? 'disease' : 'feature',
      }))
  }, [debouncedQuery, mode, availableDiseases, clinicalFeatures])

  const handleSearch = useCallback((override?: string) => {
    const q = (override ?? searchQuery).trim()
    setUrlQuery(q)
  }, [searchQuery, setUrlQuery])

  const handleDownload = useCallback((format: 'csv' | 'json') => {
    if (searchResults.length === 0) return
    const scope = selectedDisease
      ? `disease_${selectedDisease}`
      : `${mode}_${urlQuery || 'all'}`
    downloadAs(format, searchResults as unknown as Record<string, unknown>[], scope)
  }, [searchResults, selectedDisease, mode, urlQuery])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    batchUpdate({ q: null, disease: null })
    setSearchResults([])
  }, [batchUpdate])

  return (
    <Layout>
      <Breadcrumbs trail={[{ label: 'Symptoms & Diseases' }]} />

      <div className="space-y-8 max-w-5xl mx-auto">
        <header className="pt-2">
          <p className="eyebrow mb-3">
            <span className="inline-block h-px w-6 bg-accent align-middle mr-2" />
            Symptoms &amp; Diseases
          </p>
          <h1 className="font-display text-title text-primary-800 mb-2">
            Clinical feature atlas.
          </h1>
          <p className="text-sm text-primary-500 max-w-xl">
            Search by disease to find associated clinical features, or by
            symptom to surface the diseases it appears in.
          </p>
        </header>

        {loadError && (
          <EmptyState
            icon={Activity}
            title="Could not load clinical feature data"
            hint={<span className="font-mono text-[11px]">{loadError}</span>}
          />
        )}

        <div className="card space-y-5">
          <div>
            <p className="eyebrow mb-2">Mode</p>
            <div className="flex gap-2">
              <button
                onClick={() => batchUpdate({ mode: null, q: null, disease: null })}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors border ${
                  mode === 'disease'
                    ? 'bg-primary text-surface-muted border-primary'
                    : 'bg-transparent text-primary-600 border-primary-200 hover:border-primary-400'
                }`}
              >
                By disease
              </button>
              <button
                onClick={() => batchUpdate({ mode: 'symptom', q: null, disease: null })}
                className={`px-4 py-2 rounded-sm text-sm font-medium transition-colors border ${
                  mode === 'symptom'
                    ? 'bg-primary text-surface-muted border-primary'
                    : 'bg-transparent text-primary-600 border-primary-200 hover:border-primary-400'
                }`}
              >
                By symptom
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="eyebrow">
                {mode === 'disease' ? 'Find a disease' : 'Find a symptom'}
              </label>
              <p className="text-[11px] text-primary-400 font-mono">
                {mode === 'disease'
                  ? `${availableDiseases.length.toLocaleString()} indexed`
                  : `${clinicalFeatures.length.toLocaleString()} indexed`}
              </p>
            </div>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={(q) => handleSearch(q)}
              placeholder={mode === 'disease'
                ? 'Type to search diseases — try "Bardet" or "Joubert"…'
                : 'Type to search symptoms — try "retinopathy" or "polydactyly"…'}
              isLoading={isSearching}
              suggestions={suggestions}
              listboxId="symptom-suggestions"
            />
          </div>
        </div>

        {(urlQuery || selectedDisease) && !isSearching && (
          <div id="results-anchor" className="flex items-center gap-3 py-3 border-y border-primary-200">
            <span className="eyebrow">
              {mode === 'disease' ? 'Filtered by disease' : 'Filtered by symptom'}
            </span>
            <span className="flex items-center gap-2 px-3 py-1 rounded-sm bg-surface border border-primary-200 text-sm text-primary-800">
              {urlQuery || selectedDisease}
              <button
                onClick={handleClearSearch}
                className="text-primary-400 hover:text-accent transition-colors"
                aria-label="Clear filter"
              >
                ✕
              </button>
            </span>
            {searchResults.length > 0 && (
              <span className="font-mono text-[11px] text-primary-400 tabular-nums ml-auto">
                {searchResults.length.toLocaleString()} result{searchResults.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}

        {isSearching && (
          <div className="card py-8 text-center">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mx-auto mb-3" />
            <p className="text-sm text-primary-400 font-mono">Searching…</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <SearchResults
            results={searchResults}
            type="feature"
            onDownload={handleDownload}
            onClear={handleClearSearch}
          />
        )}

        {!isSearching && (urlQuery || selectedDisease) && searchResults.length === 0 && (
          <EmptyState
            icon={Search}
            title="No matching clinical features."
            hint="Try a different term or switch modes."
          />
        )}

        {features.length > 0 ? (
          <>
            {topFeaturesData.length > 0 && !urlQuery && !selectedDisease && (
              <div className="card">
                <div className="flex items-baseline justify-between mb-4">
                  <p className="eyebrow">Most common clinical features</p>
                  <p className="text-[11px] text-primary-400 font-mono">
                    Click to filter
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {topFeaturesData.map((feature, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        batchUpdate({ mode: 'symptom', q: feature.feature, disease: null })
                        // After the URL updates and results render, scroll the
                        // active-filter bar into view so the user sees the result set.
                        requestAnimationFrame(() => {
                          setTimeout(() => {
                            document
                              .getElementById('results-anchor')
                              ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }, 80)
                        })
                      }}
                      className="text-left p-4 rounded-sm border border-primary-100 hover:border-accent/50 hover:bg-surface transition-colors"
                    >
                      <div className="text-sm font-medium text-primary-800 leading-snug mb-2">{feature.feature}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase tracking-wider text-primary-400">{feature.category}</span>
                        <span className="text-xs font-mono text-accent">{feature.count}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Compact provenance strip — collection metadata, not a hero. */}
            <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-primary-400 text-center py-3 border-t border-primary-100">
              {clinicalFeatures.length.toLocaleString()} clinical features
              <span className="mx-3 text-primary-200">·</span>
              {availableDiseases.length.toLocaleString()} diseases
              <span className="mx-3 text-primary-200">·</span>
              {categoryCount} categor{categoryCount === 1 ? 'y' : 'ies'}
            </p>
          </>
        ) : !isLoading ? (
          <EmptyState
            icon={Activity}
            title="Clinical feature data not yet available."
            hint="This section populates when the symptom sheets are added to the source workbook."
          />
        ) : null}
      </div>
    </Layout>
  )
}

