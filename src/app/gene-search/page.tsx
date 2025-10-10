'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults } from '@/components/SearchComponents'
import { dataService } from '@/services/dataService'
import { CiliopathyGene } from '@/types'
import { Search, Activity as Gene, Database, MapPin } from 'lucide-react'

export default function GeneSearchPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CiliopathyGene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [totalResults, setTotalResults] = useState(0)

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      setTotalResults(0)
      return
    }

    setIsLoading(true)
    try {
      const results = await dataService.searchGenes(query)
      setSearchResults(results)
      setTotalResults(results.length)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
      setTotalResults(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = () => {
    if (searchResults.length === 0) return
    
    const csvContent = [
      ['Gene Name', 'Gene ID', 'Ciliopathy', 'Subcellular Localization', 'MIM Number', 'OMIM Phenotype', 'References'],
      ...searchResults.map(gene => [
        gene['Human Gene Name'] || '',
        gene['Human Gene ID'] || '',
        gene.Ciliopathy || '',
        gene['Subcellular Localization'] || '',
        gene['Gene MIM Number'] || '',
        gene['OMIM Phenotype Number'] || '',
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
  }

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
          <div className="max-w-2xl mx-auto">
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={() => handleSearch(searchQuery)}
              placeholder="Search by Gene Name, Ensembl Gene ID or Gene ID"
            />
          </div>
        </div>

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
              type="gene"
            />
          </div>
        )}

        {/* No Results */}
        {searchQuery && !isLoading && searchResults.length === 0 && (
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

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Searching genes...</p>
          </div>
        )}

        {/* Search Tips */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            Search Tips
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-blue-700">
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
        </div>
      </div>
    </Layout>
  )
}
