'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Filter, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SearchFilters } from '@/types'

interface AdvancedSearchProps {
  onSearch: (query: string, filters: SearchFilters) => void
  searchType: 'gene' | 'disease' | 'symptom' | 'ortholog'
  placeholder?: string
  className?: string
}

export function AdvancedSearch({ 
  onSearch, 
  searchType, 
  placeholder = "Search...",
  className 
}: AdvancedSearchProps) {
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<SearchFilters>({})
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Filter options based on search type
  const getFilterOptions = () => {
    switch (searchType) {
      case 'gene':
        return {
          localization: [
            'Ciliary Membrane',
            'Ciliary Axoneme', 
            'Basal Body',
            'Transition Zone',
            'Ciliary Rootlet'
          ],
          organism: [
            'Homo sapiens',
            'Mus musculus',
            'Danio rerio',
            'Xenopus laevis',
            'Drosophila melanogaster',
            'Caenorhabditis elegans',
            'Chlamydomonas reinhardtii'
          ]
        }
      case 'disease':
        return {
          category: [
            'Primary Ciliopathies',
            'Secondary Ciliopathies', 
            'Motile Ciliopathies',
            'Atypical Ciliopathies'
          ]
        }
      case 'symptom':
        return {
          category: [
            'Ophthalmic',
            'Neurological',
            'Skeletal',
            'Renal',
            'Respiratory',
            'Cardiovascular',
            'Metabolic'
          ]
        }
      case 'ortholog':
        return {
          organism: [
            'Mus musculus',
            'Danio rerio',
            'Xenopus laevis',
            'Drosophila melanogaster',
            'Caenorhabditis elegans',
            'Chlamydomonas reinhardtii'
          ]
        }
      default:
        return {}
    }
  }

  const filterOptions = getFilterOptions()

  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query, filters)
      setShowSuggestions(false)
    }
  }

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  // Handle filter changes
  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }))
  }

  // Clear filters
  const clearFilters = () => {
    setFilters({})
  }

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value => value && value !== '')

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={cn("w-full", className)}>
      {/* Search Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => query.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pl-12 pr-32 text-lg text-gray-900 placeholder-gray-500 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
          />
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          
          {/* Clear button */}
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setShowSuggestions(false)
              }}
              className="absolute right-28 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 hover:text-gray-600"
            >
              <X />
            </button>
          )}
          
          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors",
              hasActiveFilters 
                ? "bg-primary text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Filter className="h-4 w-4" />
            <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
          </button>
        </div>

        {/* Search button */}
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Search
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">Search Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Dynamic filter fields based on search type */}
            {filterOptions.localization && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Localization
                </label>
                <select
                  value={filters.localization || ''}
                  onChange={(e) => handleFilterChange('localization', e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All localizations</option>
                  {filterOptions.localization.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}

            {filterOptions.organism && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Organism
                </label>
                <select
                  value={filters.organism || ''}
                  onChange={(e) => handleFilterChange('organism', e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All organisms</option>
                  {filterOptions.organism.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}

            {filterOptions.category && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={filters.category || ''}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">All categories</option>
                  {filterOptions.category.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => {
                setQuery(suggestion)
                setShowSuggestions(false)
                handleSearch()
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
