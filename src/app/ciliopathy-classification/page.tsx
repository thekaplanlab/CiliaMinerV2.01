'use client'

import React, { useState, useEffect, useMemo, Suspense } from 'react'
import Layout from '@/components/Layout'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { dataService } from '@/services/dataService'
import { CiliopathyGene } from '@/types'
import { EnsemblLink, OmimLink, PubmedLinks } from '@/lib/externalLinks'
import { useUrlState, useUrlNumberState, useUrlStateBatch } from '@/lib/urlState'
import { downloadAs } from '@/lib/download'
import { Download, Database } from 'lucide-react'

const ITEMS_PER_PAGE = 50

type TabId = 'primary' | 'secondary' | 'motile' | 'atypical' | 'potential'
const VALID_TABS: TabId[] = ['primary', 'secondary', 'motile', 'atypical', 'potential']

const TAB_CLASSIFICATION_MAP: Record<TabId, string[]> = {
  primary: ['primary ciliopathies', 'primary'],
  secondary: ['secondary ciliopathies', 'secondary diseases', 'secondary'],
  motile: ['motile ciliopathies', 'motile'],
  atypical: ['atypical ciliopathies', 'atypical'],
  potential: ['potential ciliopathy genes', 'potential', 'non-ciliary'],
}

const TAB_META: Record<TabId, { label: string; description: string }> = {
  primary: {
    label: 'Primary',
    description: 'Genes associated with primary ciliopathies — disorders caused directly by defects in primary (non-motile) cilia.',
  },
  secondary: {
    label: 'Secondary',
    description: 'Genes associated with secondary diseases where ciliary dysfunction is part of a broader pathology.',
  },
  motile: {
    label: 'Motile',
    description: 'Genes associated with motile ciliopathies — disorders of motile cilia and flagella.',
  },
  atypical: {
    label: 'Atypical',
    description: 'Genes collected via the term "ciliopathy" that fall outside the standard classifications.',
  },
  potential: {
    label: 'Potential',
    description: 'Candidate ciliopathy genes primarily found in cilia or associated with cilia formation and maintenance.',
  },
}

export default function CiliopathyClassificationPage() {
  return (
    <Suspense fallback={<Layout><div className="py-20 text-center text-primary-400 text-sm">Loading…</div></Layout>}>
      <ErrorBoundary scope="classification">
        <PageInner />
      </ErrorBoundary>
    </Suspense>
  )
}

function PageInner() {
  const [tab, setTab] = useUrlState<TabId>('tab', 'primary')
  const activeTab: TabId = (VALID_TABS as readonly string[]).includes(tab) ? (tab as TabId) : 'primary'
  const [selectedCiliopathy, setSelectedCiliopathy] = useUrlState('disease', 'All')
  const [currentPage, setCurrentPage] = useUrlNumberState('page', 1)
  const batchUpdate = useUrlStateBatch()

  const [genes, setGenes] = useState<CiliopathyGene[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    dataService.getCiliopathyGenes()
      .then((genesData) => {
        if (cancelled) return
        setGenes(genesData)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Failed to load classification data:', err)
        setLoadError(err instanceof Error ? err.message : 'Unable to load data')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const tabFilteredGenes = useMemo(() => {
    const searchTerms = TAB_CLASSIFICATION_MAP[activeTab] ?? []
    if (searchTerms.length === 0) return genes
    return genes.filter(gene => {
      const cls = (gene['Ciliopathy Classification'] || '').toLowerCase().trim()
      if (!cls || cls === 'unknown' || cls === 'unclassified') return activeTab === 'atypical'
      return searchTerms.some(term => cls.includes(term))
    })
  }, [genes, activeTab])

  const filteredGenes = useMemo(() => {
    if (selectedCiliopathy === 'All') return tabFilteredGenes
    return tabFilteredGenes.filter(gene => gene.Ciliopathy === selectedCiliopathy)
  }, [tabFilteredGenes, selectedCiliopathy])

  const ciliopathyList = useMemo(() => {
    const unique = Array.from(new Set(tabFilteredGenes.map(g => g.Ciliopathy).filter(Boolean)))
    return ['All', ...unique.sort()]
  }, [tabFilteredGenes])

  const totalPages = Math.max(1, Math.ceil(filteredGenes.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const paginated = filteredGenes.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const handleDownload = (format: 'csv' | 'json') => {
    if (filteredGenes.length === 0) return
    const rows = filteredGenes.map(g => ({
      'Gene Name': g['Human Gene Name'],
      'Gene ID': g['Human Gene ID'],
      Ciliopathy: g.Ciliopathy,
      Localization: g['Subcellular Localization'],
      'MIM Number': g['Gene MIM Number'],
      References: g['Disease/Gene Reference'],
    }))
    downloadAs(format, rows, `${activeTab}_${selectedCiliopathy === 'All' ? 'all' : selectedCiliopathy}`)
  }

  return (
    <Layout>
      <Breadcrumbs trail={[{ label: 'Classification' }, { label: TAB_META[activeTab].label }]} />

      <div className="space-y-8 max-w-6xl mx-auto">
        <header className="pt-2">
          <p className="eyebrow mb-3">
            <span className="inline-block h-px w-6 bg-accent align-middle mr-2" />
            Classification
          </p>
          <h1 className="font-display text-title text-primary-800 mb-2">
            Genes organized by ciliopathy type.
          </h1>
          <p className="text-sm text-primary-500 max-w-xl">
            Five classifications from the literature. Tab selection and disease
            filter are encoded in the URL.
          </p>
        </header>

        {loadError && (
          <EmptyState
            icon={Database}
            title="Could not load classification data"
            hint={<span className="font-mono text-[11px]">{loadError}</span>}
          />
        )}

        <div className="card p-0 overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-primary-100 overflow-x-auto">
            <nav className="flex min-w-max px-2" aria-label="Classification tabs">
              {VALID_TABS.map((id) => (
                <button
                  key={id}
                  onClick={() => batchUpdate({ tab: id === 'primary' ? null : id, disease: null, page: null })}
                  className={`px-4 py-3 border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === id
                      ? 'border-accent text-accent'
                      : 'border-transparent text-primary-500 hover:text-primary-700'
                  }`}
                >
                  {TAB_META[id].label}
                  <span className={`ml-2 text-[11px] font-mono ${activeTab === id ? 'text-accent/70' : 'text-primary-300'}`}>
                    {genes.filter(gene => {
                      const terms = TAB_CLASSIFICATION_MAP[id]
                      const cls = (gene['Ciliopathy Classification'] || '').toLowerCase().trim()
                      if (!cls || cls === 'unknown' || cls === 'unclassified') return id === 'atypical'
                      return terms.some(t => cls.includes(t))
                    }).length}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            <p className="text-sm text-primary-500 mb-6 max-w-3xl leading-relaxed">
              {TAB_META[activeTab].description}
            </p>

            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block eyebrow mb-2" htmlFor="disease-filter">Filter by disease</label>
                <select
                  id="disease-filter"
                  value={selectedCiliopathy}
                  onChange={(e) => batchUpdate({ disease: e.target.value === 'All' ? null : e.target.value, page: null })}
                  className="input-field text-sm"
                >
                  {ciliopathyList.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => handleDownload('csv')}
                  disabled={filteredGenes.length === 0}
                  className="btn-secondary text-xs disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </button>
                <button
                  onClick={() => handleDownload('json')}
                  disabled={filteredGenes.length === 0}
                  className="btn-secondary text-xs disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" /> JSON
                </button>
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-3">
              <p className="eyebrow">
                {filteredGenes.length.toLocaleString()} gene{filteredGenes.length !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <p className="text-[11px] text-primary-400 font-mono">Page {safePage} / {totalPages}</p>
              )}
            </div>

            {isLoading ? (
              <div className="py-10 text-center">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-accent border-t-transparent mx-auto mb-3" />
                <p className="text-sm text-primary-400 font-mono">Loading…</p>
              </div>
            ) : filteredGenes.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No genes in this view."
                hint="Try a different tab or clear the disease filter."
              />
            ) : (
              <>
                <div className="overflow-auto rounded-sm border border-primary-100" style={{ maxHeight: '60vh' }}>
                  <table className="min-w-full divide-y divide-primary-100">
                    <thead className="bg-surface-muted sticky top-0 z-10">
                      <tr>
                        {['Gene', 'Ensembl ID', 'Ciliopathy', 'Localization', 'MIM', 'References'].map(h => (
                          <th key={h} scope="col" className="px-4 py-3 text-left eyebrow whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-primary-50">
                      {paginated.map((gene, i) => (
                        <tr key={`${gene['Human Gene Name']}-${i}`} className="hover:bg-surface-muted transition-colors">
                          <td className="px-4 py-2.5 text-xs font-mono font-semibold text-primary-800 whitespace-nowrap">
                            {gene['Human Gene Name']}
                          </td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            <EnsemblLink id={gene['Human Gene ID']} />
                          </td>
                          <td className="px-4 py-2.5 text-xs text-primary-700">{gene.Ciliopathy}</td>
                          <td className="px-4 py-2.5 text-xs text-primary-600">{gene['Subcellular Localization'] || '—'}</td>
                          <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                            <OmimLink id={gene['Gene MIM Number']} />
                          </td>
                          <td className="px-4 py-2.5 text-xs">
                            <PubmedLinks ids={gene['Disease/Gene Reference']} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-primary-400 font-mono">
                      {((safePage - 1) * ITEMS_PER_PAGE + 1).toLocaleString()}–
                      {Math.min(safePage * ITEMS_PER_PAGE, filteredGenes.length).toLocaleString()} of {filteredGenes.length.toLocaleString()}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                        disabled={safePage === 1}
                        className="btn-secondary text-xs disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-primary-500 font-mono">{safePage} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                        disabled={safePage >= totalPages}
                        className="btn-secondary text-xs disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </Layout>
  )
}
