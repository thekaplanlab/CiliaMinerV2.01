'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'
import { Search, Download, Database, Eye, Activity, Filter, X } from 'lucide-react'

interface SearchFilters {
  searchType: 'gene' | 'disease' | 'ortholog' | 'all'
  disease?: string
  symptom?: string
  organism?: string
  localization?: string
  minGenes?: number
  maxGenes?: number
}

interface SearchResults {
  genes: CiliopathyGene[]
  features: CiliopathyFeature[]
  orthologs: OrthologGene[]
  totalResults: number
}

export default function AdvancedSearchPage() {
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
  const [availableFilters, setAvailableFilters] = useState({
    diseases: [] as string[],
    symptoms: [] as string[],
    organisms: [] as string[],
    localizations: [] as string[]
  })

  useEffect(() => {
    loadAvailableFilters()
  }, [])

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

      console.log('Starting search with query:', searchQuery, 'and filters:', filters)

      // Load data based on search type
      if (filters.searchType === 'all' || filters.searchType === 'gene') {
        genes = await dataService.getCiliopathyGenes()
        console.log('Loaded genes:', genes.length)
      }
      if (filters.searchType === 'all' || filters.searchType === 'disease') {
        features = await dataService.getCiliopathyFeatures()
        console.log('Loaded features:', features.length)
      }
      if (filters.searchType === 'all' || filters.searchType === 'ortholog') {
        orthologs = await dataService.getAllOrthologData()
        console.log('Loaded orthologs:', orthologs.length)
      }

      // Apply filters (with null safety)
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
          f.Category?.toLowerCase().includes(filters.symptom!.toLowerCase()) ||
          f['General Titles']?.toLowerCase().includes(filters.symptom!.toLowerCase())
        )
      }

      if (filters.organism) {
        orthologs = orthologs.filter(o => o.Organism?.toLowerCase().includes(filters.organism!.toLowerCase()))
      }

      if (filters.localization) {
        genes = genes.filter(g => g['Subcellular Localization']?.toLowerCase().includes(filters.localization!.toLowerCase()))
      }

      // Apply text search with smart matching
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const genesBeforeFilter = genes.length
        const featuresBeforeFilter = features.length
        const orthologsBeforeFilter = orthologs.length

        // Helper function for smart matching
        const smartMatch = (text: string | number | undefined, query: string): boolean => {
          if (!text) return false
          const textLower = text.toString().toLowerCase()
          
          // Exact match gets highest priority
          if (textLower === query) return true
          
          // Word boundary match (e.g., "bbs1" matches "BBS1" but not "BBS10")
          // Check if query appears as a complete word
          const wordBoundaryRegex = new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
          if (wordBoundaryRegex.test(text.toString())) return true
          
          // For very short queries (1-2 chars), require exact match to avoid too many results
          if (query.length <= 2) return textLower === query
          
          // For longer queries, allow substring match but prioritize start-of-word matches
          if (textLower.includes(query)) {
            // Check if it starts with query (e.g., "bardet" matches "Bardet-Biedl Syndrome")
            if (textLower.startsWith(query)) return true
            // Check if it appears after a space or special character
            if (textLower.includes(' ' + query) || textLower.includes('-' + query)) return true
          }
          
          return false
        }

        genes = genes.filter(g => 
          smartMatch(g['Human Gene Name'], query) ||
          smartMatch(g['Human Gene ID'], query) ||
          g.Ciliopathy?.toLowerCase().includes(query) ||
          smartMatch(g['Gene MIM Number'], query) ||
          smartMatch(g.Abbreviation, query)
        )
        features = features.filter(f => 
          f.Disease?.toLowerCase().includes(query) ||
          f.Category?.toLowerCase().includes(query) ||
          f.Feature?.toLowerCase().includes(query) ||
          f['Ciliopathy / Clinical Features']?.toLowerCase().includes(query)
        )
        orthologs = orthologs.filter(o => 
          smartMatch(o['Human Gene'], query) ||
          smartMatch(o['Human Gene Name'], query) ||
          smartMatch(o['Ortholog Gene'], query) ||
          smartMatch(o['Ortholog Gene Name'], query) ||
          o['Human Disease']?.toLowerCase().includes(query)
        )

        console.log(`After text search for "${query}":`)
        console.log(`  Genes: ${genesBeforeFilter} -> ${genes.length}`)
        console.log(`  Features: ${featuresBeforeFilter} -> ${features.length}`)
        console.log(`  Orthologs: ${orthologsBeforeFilter} -> ${orthologs.length}`)
        
        if (genes.length > 0) {
          console.log('Sample gene match:', genes[0])
        }
      }

      const totalResults = genes.length + features.length + orthologs.length
      console.log('Total results:', totalResults)

      setResults({
        genes,
        features,
        orthologs,
        totalResults
      })
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({
      searchType: 'all'
    })
    setSearchQuery('')
  }

  const handleDownload = (data: any[], filename: string) => {
    if (data.length === 0) return
    
    const csvContent = [
      Object.keys(data[0]),
      ...data.map(row => Object.values(row))
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Advanced Search
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            Search across genes, diseases, symptoms, and orthologs with advanced filtering options. 
            Find specific ciliopathy-related information using multiple criteria.
          </p>
        </div>

        {/* Search Interface */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-6">
            {/* Main Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Query
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search for genes, diseases, symptoms, or orthologs..."
                  className="w-full pl-10 pr-4 py-2 text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Search Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Type
              </label>
              <select
                value={filters.searchType}
                onChange={(e) => setFilters({ ...filters, searchType: e.target.value as any })}
                className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                <option value="all">All Types</option>
                <option value="gene">Genes Only</option>
                <option value="disease">Diseases Only</option>
                <option value="ortholog">Orthologs Only</option>
              </select>
            </div>

            {/* Filter Toggle */}
            <div className="flex justify-between items-center">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Hide' : 'Show'} Advanced Filters
              </button>
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
              >
                <X className="h-4 w-4" />
                Clear All
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disease
                  </label>
                  <select
                    value={filters.disease || ''}
                    onChange={(e) => setFilters({ ...filters, disease: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Diseases</option>
                    {availableFilters.diseases.map(disease => (
                      <option key={disease} value={disease}>{disease}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symptom Category
                  </label>
                  <select
                    value={filters.symptom || ''}
                    onChange={(e) => setFilters({ ...filters, symptom: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Symptoms</option>
                    {availableFilters.symptoms.map(symptom => (
                      <option key={symptom} value={symptom}>{symptom}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organism
                  </label>
                  <select
                    value={filters.organism || ''}
                    onChange={(e) => setFilters({ ...filters, organism: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Organisms</option>
                    {availableFilters.organisms.map(organism => (
                      <option key={organism} value={organism}>{organism}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subcellular Localization
                  </label>
                  <select
                    value={filters.localization || ''}
                    onChange={(e) => setFilters({ ...filters, localization: e.target.value || undefined })}
                    className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Localizations</option>
                    {availableFilters.localizations.map(localization => (
                      <option key={localization} value={localization}>{localization}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Search Button */}
            <div className="text-center">
              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="bg-primary hover:bg-primary-dark disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {results.totalResults > 0 && (
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Search Results ({results.totalResults} found)
                </h2>
                <div className="flex gap-2">
                  {results.genes.length > 0 && (
                    <button
                      onClick={() => handleDownload(results.genes, 'ciliaminer_advanced_search_genes.csv')}
                      className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Genes
                    </button>
                  )}
                  {results.features.length > 0 && (
                    <button
                      onClick={() => handleDownload(results.features, 'ciliaminer_advanced_search_features.csv')}
                      className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Features
                    </button>
                  )}
                  {results.orthologs.length > 0 && (
                    <button
                      onClick={() => handleDownload(results.orthologs, 'ciliaminer_advanced_search_orthologs.csv')}
                      className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download Orthologs
                    </button>
                  )}
                </div>
              </div>

              {/* Results Tabs */}
              <div className="grid md:grid-cols-3 gap-4">
                {results.genes.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <Database className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-blue-800">{results.genes.length}</h3>
                    <p className="text-blue-700">Genes Found</p>
                  </div>
                )}
                {results.features.length > 0 && (
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <Eye className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-green-800">{results.features.length}</h3>
                    <p className="text-green-700">Features Found</p>
                  </div>
                )}
                {results.orthologs.length > 0 && (
                  <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <Activity className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <h3 className="text-lg font-semibold text-purple-800">{results.orthologs.length}</h3>
                    <p className="text-purple-700">Orthologs Found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Genes Results */}
            {results.genes.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Genes ({results.genes.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gene Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gene ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciliopathy</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localization</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.genes.slice(0, 20).map((gene, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {gene['Human Gene Name']}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {gene['Human Gene ID']}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {gene.Ciliopathy}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {gene['Subcellular Localization']}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.genes.length > 20 && (
                  <div className="mt-4 text-center text-sm text-gray-500">
                    Showing first 20 results. Download full results for complete data.
                  </div>
                )}
              </div>
            )}

            {/* Features Results */}
            {results.features.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Clinical Features ({results.features.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disease</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Feature</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.features.slice(0, 20).map((feature, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {feature.Disease}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {feature.Category}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {feature.Feature}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {feature.Count}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.features.length > 20 && (
                  <div className="mt-4 text-center text-sm text-gray-500">
                    Showing first 20 results. Download full results for complete data.
                  </div>
                )}
              </div>
            )}

            {/* Orthologs Results */}
            {results.orthologs.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Orthologs ({results.orthologs.length})
                </h3>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Human Gene</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Human Disease</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ortholog Gene</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organism</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.orthologs.slice(0, 20).map((ortholog, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ortholog['Human Gene']}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ortholog['Human Disease']}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {ortholog['Ortholog Gene']}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ortholog.Organism}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {results.orthologs.length > 20 && (
                  <div className="mt-4 text-center text-sm text-gray-500">
                    Showing first 20 results. Download full results for complete data.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {!isLoading && results.totalResults === 0 && searchQuery && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No results found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search terms or filters to find what you're looking for.
            </p>
            <p className="text-sm text-gray-500 mt-4">
              Searched for: "<span className="font-medium text-gray-700">{searchQuery}</span>"
            </p>
          </div>
        )}
      </div>
    </Layout>
  )
}
