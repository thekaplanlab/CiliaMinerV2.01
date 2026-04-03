'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'
import { 
  Search, 
  Download, 
  Database, 
  Filter, 
  X, 
  ArrowUpDown,
  BarChart3
} from 'lucide-react'
import { BarPlot, CiliaMinerPieChart } from '@/components/ChartComponents'

interface SearchFilters {
  searchType: 'gene' | 'disease' | 'ortholog' | 'all'
  disease?: string
  symptom?: string
  organism?: string
  localization?: string
}

interface SearchResults {
  genes: CiliopathyGene[]
  features: CiliopathyFeature[]
  orthologs: OrthologGene[]
  totalResults: number
}

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

function Pagination({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}: {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (fn: (p: number) => number) => void
}) {
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const start = (currentPage - 1) * itemsPerPage + 1
  const end = Math.min(currentPage * itemsPerPage, totalItems)
  return (
    <div className="flex items-center justify-between mt-3">
      <p className="text-sm text-gray-600">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(p => p + 1)}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 text-sm border rounded-md disabled:opacity-40 hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default function AdvancedSearchDataExplorerPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<SearchFilters>({
    searchType: 'all'
  })
  const [results, setResults] = useState<SearchResults>({
    genes: [],
    features: [],
    orthologs: [],
    totalResults: 0
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showCharts, setShowCharts] = useState(false)
  const [availableFilters, setAvailableFilters] = useState({
    diseases: [] as string[],
    symptoms: [] as string[],
    organisms: [] as string[],
    localizations: [] as string[]
  })
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [featuresPage, setFeaturesPage] = useState(1)
  const [orthologsPage, setOrthologsPage] = useState(1)
  const [itemsPerPage] = useState(25)
  const [allData, setAllData] = useState<SearchResults>({
    genes: [],
    features: [],
    orthologs: [],
    totalResults: 0
  })
  const [isLoadingData, setIsLoadingData] = useState(true)

  useEffect(() => {
    loadAvailableFilters()
    loadAllData()
  }, [])

  const loadAllData = async () => {
    setIsLoadingData(true)
    try {
      const [genes, features, orthologs] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getCiliopathyFeatures(),
        dataService.getAllOrthologData()
      ])
      
      setAllData({
        genes,
        features,
        orthologs,
        totalResults: genes.length + features.length + orthologs.length
      })
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const loadAvailableFilters = async () => {
    try {
      const [genes, features, orthologs] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getCiliopathyFeatures(),
        dataService.getAllOrthologData()
      ])

      const diseases = Array.from(new Set(genes.map(g => g.Ciliopathy).filter(Boolean)))
      const symptoms = Array.from(new Set(features.map(f => f.Category).filter(Boolean)))
      const organisms = Array.from(new Set(orthologs.map(o => o.Organism).filter(Boolean)))
      const localizations = Array.from(new Set(genes.map(g => g['Subcellular Localization']).filter(Boolean)))

      setAvailableFilters({
        diseases: diseases.sort(),
        symptoms: symptoms.sort(),
        organisms: organisms.sort(),
        localizations: localizations.sort()
      })
    } catch (error) {
      console.error('Failed to load filter options:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim() && Object.keys(filters).length === 1) return

    setIsLoading(true)
    try {
      let genes: CiliopathyGene[] = []
      let features: CiliopathyFeature[] = []
      let orthologs: OrthologGene[] = []

      // Load data based on search type
      if (filters.searchType === 'all' || filters.searchType === 'gene') {
        genes = await dataService.getCiliopathyGenes()
      }
      if (filters.searchType === 'all' || filters.searchType === 'disease') {
        features = await dataService.getCiliopathyFeatures()
      }
      if (filters.searchType === 'all' || filters.searchType === 'ortholog') {
        orthologs = await dataService.getAllOrthologData()
      }

      // Apply search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        genes = genes.filter(g =>
          g['Human Gene Name']?.toLowerCase().includes(query) ||
          g.Ciliopathy?.toLowerCase().includes(query) ||
          g['Gene MIM Number']?.toLowerCase().includes(query)
        )
        features = features.filter(f =>
          f.Disease?.toLowerCase().includes(query) ||
          f['Ciliopathy / Clinical Features']?.toLowerCase().includes(query)
        )
        orthologs = orthologs.filter(o =>
          o['Human Gene Name']?.toLowerCase().includes(query) ||
          o['Ortholog Gene Name']?.toLowerCase().includes(query)
        )
      }

      // Apply filters
      if (filters.disease) {
        genes = genes.filter(g => g.Ciliopathy?.toLowerCase().includes(filters.disease!.toLowerCase()))
        features = features.filter(f => 
          f.Disease?.toLowerCase().includes(filters.disease!.toLowerCase()) ||
          f.Ciliopathy?.toLowerCase().includes(filters.disease!.toLowerCase())
        )
        orthologs = orthologs.filter(o => o['Human Disease']?.toLowerCase().includes(filters.disease!.toLowerCase()))
      }

      if (filters.symptom) {
        features = features.filter(f => 
          f.Category?.toLowerCase().includes(filters.symptom!.toLowerCase())
        )
      }

      if (filters.organism) {
        orthologs = orthologs.filter(o => o.Organism?.toLowerCase().includes(filters.organism!.toLowerCase()))
      }

      if (filters.localization) {
        genes = genes.filter(g =>
          g['Subcellular Localization']?.toLowerCase().includes(filters.localization!.toLowerCase())
        )
      }

      const totalResults = genes.length + features.length + orthologs.length
      setResults({ genes, features, orthologs, totalResults })
      setCurrentPage(1)
      setFeaturesPage(1)
      setOrthologsPage(1)
    } catch (error) {
      console.error('Search failed:', error)
      setResults({ genes: [], features: [], orthologs: [], totalResults: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const sortedResults = useMemo(() => {
    if (!sortConfig.key) return results

    const sorted = { ...results }
    const sortFn = (a: any, b: any) => {
      const aVal = a[sortConfig.key]
      const bVal = b[sortConfig.key]
      if (aVal === bVal) return 0
      return sortConfig.direction === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    }

    sorted.genes = [...results.genes].sort(sortFn)
    sorted.features = [...results.features].sort(sortFn)
    sorted.orthologs = [...results.orthologs].sort(sortFn)

    return sorted
  }, [results, sortConfig])

  const handleDownload = (format: 'csv' | 'json') => {
    const data = { genes: sortedResults.genes, features: sortedResults.features, orthologs: sortedResults.orthologs }
    const content = format === 'json' ? JSON.stringify(data, null, 2) : convertToCSV(data)
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `advanced_search_results.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const convertToCSV = (data: { genes: CiliopathyGene[]; features: CiliopathyFeature[]; orthologs: OrthologGene[] }) => {
    const rows: string[] = []
    if (data.genes.length > 0) {
      rows.push('--- Genes ---')
      rows.push('Gene Name,Ciliopathy,Localization,MIM Number')
      data.genes.forEach(g => {
        rows.push([g['Human Gene Name'], g.Ciliopathy, g['Subcellular Localization'], g['Gene MIM Number']].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
      })
    }
    if (data.features.length > 0) {
      rows.push('')
      rows.push('--- Clinical Features ---')
      rows.push('Disease,Feature,Category')
      data.features.forEach(f => {
        rows.push([f.Disease || f.Ciliopathy, f['Ciliopathy / Clinical Features'] || f.Feature, f.Category].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
      })
    }
    if (data.orthologs.length > 0) {
      rows.push('')
      rows.push('--- Orthologs ---')
      rows.push('Human Gene,Ortholog Gene,Organism')
      data.orthologs.forEach(o => {
        rows.push([o['Human Gene Name'], o['Ortholog Gene Name'], o.Organism].map(v => `"${(v || '').replace(/"/g, '""')}"`).join(','))
      })
    }
    return rows.join('\n')
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Advanced Search & Data Explorer
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive search and data exploration tools for ciliopathy research
          </p>
        </div>

        {/* Advanced Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Search className="h-6 w-6 mr-2" />
            Advanced Search
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for genes, diseases, or features..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            {/* Search Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Type
              </label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'gene', 'disease', 'ortholog'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilters({ ...filters, searchType: type })}
                    className={`px-4 py-2 rounded-lg capitalize ${
                      filters.searchType === type
                        ? 'bg-primary text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? 'Hide' : 'Show'} Advanced Filters
            </button>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Disease</label>
                  <select
                    value={filters.disease || ''}
                    onChange={(e) => setFilters({ ...filters, disease: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All Diseases</option>
                    {availableFilters.diseases.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Organism</label>
                  <select
                    value={filters.organism || ''}
                    onChange={(e) => setFilters({ ...filters, organism: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All Organisms</option>
                    {availableFilters.organisms.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Localization</label>
                  <select
                    value={filters.localization || ''}
                    onChange={(e) => setFilters({ ...filters, localization: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All Localizations</option>
                    {availableFilters.localizations.map((l) => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Symptom Category</label>
                  <select
                    value={filters.symptom || ''}
                    onChange={(e) => setFilters({ ...filters, symptom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">All Categories</option>
                    {availableFilters.symptoms.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={handleSearch}
              disabled={isLoading}
              className="w-full bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary-dark disabled:bg-gray-400 font-medium"
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {/* Search Results */}
        {results.totalResults > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">
                Search Results ({results.totalResults})
              </h2>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleDownload('csv')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => handleDownload('json')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </button>
              </div>
            </div>

            {/* Genes Results */}
            {sortedResults.genes.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Genes ({sortedResults.genes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Gene Name</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Ciliopathy</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Localization</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedResults.genes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((gene, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                            {gene['Human Gene Name']}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{gene.Ciliopathy}</td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">
                            {gene['Subcellular Localization']}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedResults.genes.length > itemsPerPage && (
                  <Pagination
                    currentPage={currentPage}
                    totalItems={sortedResults.genes.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                )}
              </div>
            )}

            {/* Features Results */}
            {sortedResults.features.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Clinical Features ({sortedResults.features.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200" role="table">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Disease</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Feature</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Category</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedResults.features.slice((featuresPage - 1) * itemsPerPage, featuresPage * itemsPerPage).map((feature, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                            {feature.Disease || feature.Ciliopathy}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">
                            {feature['Ciliopathy / Clinical Features'] || feature.Feature}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{feature.Category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedResults.features.length > itemsPerPage && (
                  <Pagination
                    currentPage={featuresPage}
                    totalItems={sortedResults.features.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setFeaturesPage}
                  />
                )}
              </div>
            )}

            {/* Orthologs Results */}
            {sortedResults.orthologs.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Orthologs ({sortedResults.orthologs.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200" role="table">
                    <thead className="bg-gray-100">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Human Gene</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Ortholog Gene</th>
                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-700 uppercase">Organism</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedResults.orthologs.slice((orthologsPage - 1) * itemsPerPage, orthologsPage * itemsPerPage).map((ortholog, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                            {ortholog['Human Gene Name']}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">
                            {ortholog['Ortholog Gene Name']}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-900">{ortholog.Organism}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedResults.orthologs.length > itemsPerPage && (
                  <Pagination
                    currentPage={orthologsPage}
                    totalItems={sortedResults.orthologs.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setOrthologsPage}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Data Explorer - All Data Overview */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Database className="h-6 w-6 mr-2" />
              Data Explorer - Database Overview
            </h2>
            <button
              onClick={() => setShowCharts(!showCharts)}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              {showCharts ? 'Hide' : 'Show'} Charts
            </button>
          </div>

          {isLoadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading database overview...</p>
            </div>
          ) : (
            <>
              {/* Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-blue-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-blue-600">{allData.genes.length.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-2">Total Genes</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-green-600">
                    {allData.features.length > 0 ? allData.features.length.toLocaleString() : <span className="text-gray-400">N/A</span>}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">Clinical Features</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-purple-600">{allData.orthologs.length.toLocaleString()}</div>
                  <div className="text-sm text-gray-600 mt-2">Orthologs</div>
                </div>
              </div>

              {/* Charts */}
              {showCharts && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                      Data Distribution by Type
                    </h3>
                    <CiliaMinerPieChart
                      data={[
                        { Disease: 'Genes', Gene_numbers: allData.genes.length },
                        { Disease: 'Features', Gene_numbers: allData.features.length },
                        { Disease: 'Orthologs', Gene_numbers: allData.orthologs.length }
                      ]}
                      height={300}
                      title=""
                    />
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
                      Database Statistics
                    </h3>
                    <BarPlot
                      data={[
                        { name: 'Genes', value: allData.genes.length },
                        { name: 'Features', value: allData.features.length },
                        { name: 'Orthologs', value: allData.orthologs.length }
                      ]}
                      height={300}
                      title=""
                    />
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-gray-600">Unique Diseases</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {new Set(allData.genes.map(g => g.Ciliopathy).filter(Boolean)).size}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Organisms</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {allData.orthologs.length > 0
                        ? new Set(allData.orthologs.map(o => o.Organism)).size
                        : <span className="text-gray-400 text-lg">N/A</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Localizations</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {new Set(allData.genes.map(g => g['Subcellular Localization']).filter(Boolean)).size}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Categories</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {allData.features.length > 0
                        ? new Set(allData.features.map(f => f.Category).filter(Boolean)).size
                        : <span className="text-gray-400 text-lg">N/A</span>}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
