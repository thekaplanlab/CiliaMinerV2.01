'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'

interface SearchInputProps {
  placeholder: string
  value: string
  onChange: (value: string) => void
  suggestions?: string[]
  onSearch?: () => void
  isLoading?: boolean
}

export function SearchInput({ 
  placeholder, 
  value, 
  onChange, 
  suggestions = [], 
  onSearch,
  isLoading = false
}: SearchInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Show suggestions when suggestions array updates and we have input
  useEffect(() => {
    if (value.length > 0 && suggestions.length > 0) {
      setShowSuggestions(true)
    } else if (suggestions.length === 0 && value.length > 0) {
      // Keep suggestions hidden if no matches but typing continues
      setShowSuggestions(false)
    }
  }, [suggestions, value])

  const handleInputChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    // Don't update showSuggestions here - let the useEffect handle it
  }, [onChange])

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestions(false)
    if (onSearch) onSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (onSearch) onSearch()
      setShowSuggestions(false)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full px-4 py-3 pl-12 pr-12 text-lg text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent shadow-sm"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        {isLoading ? (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
          </div>
        ) : value ? (
          <button
            onClick={() => {
              onChange('')
              setShowSuggestions(false)
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
          >
            <X />
          </button>
        ) : null}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left text-gray-900 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SearchResultsProps {
  results: CiliopathyGene[] | CiliopathyFeature[]
  type: 'gene' | 'ciliopathy' | 'feature'
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}

export function SearchResults({ results, type, onDownload, onClear }: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No results found. Please try a different search term.
      </div>
    )
  }

  const headers = type === 'gene' 
    ? ['Ciliopathy', 'Human Gene Name', 'Ensembl Gene ID', 'Subcellular Localization', 'Gene MIM Number', 'OMIM Phenotype', 'GO Terms', 'Reactome', 'KEGG']
    : type === 'feature'
    ? ['Disease', 'Clinical Feature', 'Category']
    : ['Ciliopathy', 'Feature', 'Category']

  const renderLinks = (ids: string[], makeHref: (id: string) => string) => {
    if (!ids || ids.length === 0) return <span className="text-gray-500">Unknown</span>
    const shown = ids.slice(0, 3)
    const remaining = ids.length - shown.length

    return (
      <div className="flex flex-col gap-1 items-center">
        {shown.map((id) => (
          <a
            key={id}
            href={makeHref(id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            {id}
          </a>
        ))}
        {remaining > 0 && <span className="text-xs text-gray-500">+{remaining} more</span>}
      </div>
    )
  }

  // Helper function to create OMIM link
  const createOMIMLink = (mimNumber: string) => {
    if (!mimNumber || mimNumber === '-') return mimNumber || '-'
    const cleanNumber = mimNumber.replace(/[^\d]/g, '')
    if (!cleanNumber) return mimNumber
    return (
      <a 
        href={`https://omim.org/entry/${cleanNumber}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
      >
        {mimNumber}
      </a>
    )
  }

  // Helper function to create Ensembl link for Gene ID
  const createEnsemblLink = (geneId: string, geneName: string) => {
    if (!geneId || geneId === '-') return '-'
    // Convert to string if it's not already
    const geneIdStr = String(geneId)
    // If it's an Ensembl ID (starts with ENSG)
    if (geneIdStr.startsWith('ENSG')) {
      return (
        <a 
          href={`https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=${geneIdStr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {geneIdStr}
        </a>
      )
    }
    // Otherwise, search by gene name
    return (
      <a 
        href={`https://www.ensembl.org/Homo_sapiens/Search/Results?q=${geneName}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
      >
        {geneIdStr}
      </a>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden mt-8">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Search Results ({results.length})
          </h3>
          <div className="flex space-x-2">
            {onClear && (
              <button
                onClick={onClear}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
            {onDownload && (
              <>
                <button
                  onClick={() => onDownload('csv')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => onDownload('json')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {type === 'gene' ? (
                  <>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyGene).Ciliopathy}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                      {(result as CiliopathyGene)['Human Gene Name']}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {createEnsemblLink(
                        (result as CiliopathyGene)['Human Gene ID'] || '-',
                        (result as CiliopathyGene)['Human Gene Name']
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyGene)['Subcellular Localization']}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {createOMIMLink((result as CiliopathyGene)['Gene MIM Number'])}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {createOMIMLink((result as CiliopathyGene)['OMIM Phenotype Number'])}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {renderLinks(
                        (result as CiliopathyGene).go_terms || [],
                        (goId) => `https://www.ebi.ac.uk/QuickGO/term/${encodeURIComponent(goId)}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {renderLinks(
                        (result as CiliopathyGene).reactome_pathways || [],
                        (reactomeId) => `https://reactome.org/content/detail/${encodeURIComponent(reactomeId)}`
                      )}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {renderLinks(
                        (result as CiliopathyGene).kegg_pathways || [],
                        (keggId) => `https://www.kegg.jp/entry/${encodeURIComponent(keggId)}`
                      )}
                    </td>
                  </>
                ) : type === 'feature' ? (
                  <>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature).Disease || (result as CiliopathyFeature).Ciliopathy}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature)['Ciliopathy / Clinical Features'] || (result as CiliopathyFeature).Feature}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature).Category}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature).Ciliopathy}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature).Feature}
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-900">
                      {(result as CiliopathyFeature).Category}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface TabPanelProps {
  tabs: Array<{ id: string; label: string; count: number }>
  activeTab: string
  onTabChange: (tabId: string) => void
}

export function TabPanel({ tabs, activeTab, onTabChange }: TabPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex space-x-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>
    </div>
  )
}

interface OrthologResultsProps {
  results: OrthologGene[]
  onDownload?: (format: 'csv' | 'json') => void
  onClear?: () => void
}

export function OrthologResults({ results, onDownload, onClear }: OrthologResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No results found. Please try a different search term.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Ortholog Search Results ({results.length})
          </h3>
          <div className="flex space-x-2">
            {onClear && (
              <button
                onClick={onClear}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                <X className="h-4 w-4 mr-2" />
                Clear
              </button>
            )}
            {onDownload && (
              <>
                <button
                  onClick={() => onDownload('csv')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => onDownload('json')}
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  JSON
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Human Gene
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Human Disease
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Ortholog Gene
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Organism
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                Ortholog Disease
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                  {result['Human Gene Name']}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {result['Human Disease']}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {result['Ortholog Gene Name']}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {result.Organism}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900">
                  {result['Ortholog Disease']}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
