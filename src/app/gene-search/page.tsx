'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults } from '@/components/SearchComponents'
import { dataService } from '@/services/dataService'
import { CiliopathyGene } from '@/types'
import { useDebounce } from '@/lib/utils'
import { Search, Activity as Gene, Database, MapPin } from 'lucide-react'

export default function GeneSearchPage() {
  const [showSearchTips, setShowSearchTips] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CiliopathyGene[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [totalResults, setTotalResults] = useState(0)
  const [cachedGenes, setCachedGenes] = useState<CiliopathyGene[]>([])

  // Debounce search query with 300ms delay for suggestions
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Load genes data once on mount
  useEffect(() => {
    const loadGenes = async () => {
      try {
        const genes = await dataService.getCiliopathyGenes()
        setCachedGenes(genes)
      } catch (error) {
        console.error('Failed to load genes:', error)
      }
    }
    loadGenes()
  }, [])

  // Load suggestions as user types (using cached data)
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSuggestions([])
      return
    }

    if (cachedGenes.length === 0) {
      return
    }

    try {
      const query = debouncedSearchQuery.toLowerCase()
      
      // Show more suggestions for single-letter searches
      const maxSuggestions = query.length === 1 ? 15 : 10
      
      const uniqueSuggestions = Array.from(new Set(
        cachedGenes
          .filter(g => g['Human Gene Name']?.toLowerCase().startsWith(query))
          .map(g => g['Human Gene Name'])
          .filter((name): name is string => Boolean(name))
      ))
        .slice(0, maxSuggestions)
      
      setSuggestions(uniqueSuggestions)
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      setSuggestions([])
    }
  }, [debouncedSearchQuery, cachedGenes])

  // Search only when explicitly called
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setTotalResults(0)
      return
    }

    setIsSearching(true)
    try {
      const results = await dataService.searchGenes(searchQuery)
      setSearchResults(results)
      setTotalResults(results.length)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
      setTotalResults(0)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery])

  const handleDownload = useCallback(() => {
    if (searchResults.length === 0) return
    
    const csvContent = [
      ['Gene Name', 'Ensembl Gene ID', 'Ciliopathy', 'Subcellular Localization', 'MIM Number', 'OMIM Phenotype', 'GO Terms', 'Reactome', 'KEGG', 'References'],
      ...searchResults.map(gene => [
        gene['Human Gene Name'] || '',
        gene['Human Gene ID'] || '',
        gene.Ciliopathy || '',
        gene['Subcellular Localization'] || '',
        gene['Gene MIM Number'] || '',
        gene['OMIM Phenotype Number'] || '',
        (gene.go_terms || []).join('; '),
        (gene.reactome_pathways || []).join('; '),
        (gene.kegg_pathways || []).join('; '),
        gene['Disease/Gene Reference'] || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ciliaminer_gene_search_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }, [searchResults])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setSuggestions([])
    setTotalResults(0)
    setIsSearching(false)
  }, [])

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Gene Search
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Search for a gene to list associated ciliopathy disorder(s). 
            Find genes by name, Ensembl Gene ID, or Gene ID.
          </p>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {cachedGenes.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Try searching for:</h4>
                <div className="flex flex-wrap gap-2">
                  {['BBS1', 'CEP290', 'PKD1', 'IFT88', 'RPGR', 'NPHP1', 'Joubert', 'Bardet-Biedl'].map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => {
                        setSearchQuery(term)
                        setTimeout(() => handleSearch(), 0)
                      }}
                      className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-colors font-medium"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              placeholder="Search by Gene Name, Ensembl Gene ID or Gene ID..."
              isLoading={isSearching}
              suggestions={suggestions}
            />
          </div>
        </div>

        {/* Database Stats - when no search yet */}
        {cachedGenes.length > 0 && !searchQuery && (
          <div className="text-center">
            <p className="text-gray-600">
              <span className="text-2xl font-bold text-primary">{cachedGenes.length.toLocaleString()}</span> genes available in the database
            </p>
          </div>
        )}

        {/* Loading State */}
        {isSearching && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center" role="status" aria-live="polite" aria-label="Searching genes">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Searching genes...</p>
          </div>
        )}

        {/* Results Section */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-800">
                Search Results ({totalResults} genes found)
              </h2>
              <button
                onClick={handleDownload}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Database className="h-4 w-4" />
                Download CSV
              </button>
            </div>

            <SearchResults
              results={searchResults}
              onDownload={handleDownload}
              onClear={handleClearSearch}
              type="gene"
            />
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchQuery && searchResults.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Gene className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No genes found
            </h3>
            <p className="text-gray-500">
              Try adjusting your search terms or browse our gene database.
            </p>
          </div>
        )}

        {/* Search Tips - Collapsible */}
        <div className="bg-blue-50 rounded-lg">
          <button
            type="button"
            onClick={() => setShowSearchTips(!showSearchTips)}
            className="w-full flex items-center justify-between p-6 text-left"
            aria-expanded={showSearchTips}
          >
            <h3 className="text-lg font-semibold text-blue-800">
              Search Tips
            </h3>
            {showSearchTips ? (
              <ChevronUp className="h-5 w-5 text-blue-800" aria-hidden />
            ) : (
              <ChevronDown className="h-5 w-5 text-blue-800" aria-hidden />
            )}
          </button>
          {showSearchTips && (
            <div className="px-6 pb-6 grid md:grid-cols-2 gap-4 text-sm text-blue-700">
            <div>
              <h4 className="font-medium mb-2">Gene Names</h4>
              <ul className="space-y-1">
                <li>• Use official gene symbols (e.g., BBS1, PKD1)</li>
                <li>• Try alternative names or aliases</li>
                <li>• Search is case-insensitive</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Gene IDs</h4>
              <ul className="space-y-1">
                <li>• Use Ensembl Gene IDs</li>
                <li>• Use NCBI Gene IDs</li>
                <li>• Use MIM numbers</li>
              </ul>
            </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
