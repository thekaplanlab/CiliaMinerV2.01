'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults } from '@/components/SearchComponents'
import { CiliopathyFeature } from '@/types'
import { dataService } from '@/services/dataService'
import { downloadCSV, downloadJSON, useDebounce } from '@/lib/utils'
import { FileText, Search, Filter, Activity, Eye, Brain, Heart, Zap, Users, ActivitySquare, CircleDot } from 'lucide-react'

export default function SymptomsDiseasesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<CiliopathyFeature[]>([])
  const [activeTab, setActiveTab] = useState<'disease' | 'symptom'>('disease')
  const [selectedDisease, setSelectedDisease] = useState<string>('')
  const [hasFeatureData, setHasFeatureData] = useState(false)
  const [availableDiseases, setAvailableDiseases] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [clinicalFeatures, setClinicalFeatures] = useState<string[]>([])
  const [symptomCounts, setSymptomCounts] = useState<{ [key: string]: number }>({})
  const [topFeaturesData, setTopFeaturesData] = useState<Array<{ feature: string; count: number; category: string }>>([])

  // Debounce search query with 300ms delay for suggestions
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Load available diseases and clinical features
  useEffect(() => {
    loadData()
  }, [])

  // Automatically search when a disease is selected from dropdown
  useEffect(() => {
    if (selectedDisease && activeTab === 'disease') {
      performDiseaseDropdownSearch(selectedDisease)
    }
  }, [selectedDisease])

  const loadData = async () => {
    try {
      const features = await dataService.getCiliopathyFeatures()
      
      // Extract unique diseases and clinical features
      const diseases = Array.from(new Set(features.map(f => f.Disease).filter((d): d is string => Boolean(d)))).sort()
      const featuresList = Array.from(new Set(features.map(f => f['Ciliopathy / Clinical Features']).filter((f): f is string => Boolean(f)))).sort()
      
      setAvailableDiseases(diseases)
      setClinicalFeatures(featuresList)
      setHasFeatureData(features.length > 0)
      
      // Calculate symptom counts by category
      const categoryCounts: { [key: string]: number } = {}
      features.forEach(feature => {
        const category = feature.Category?.toLowerCase() || feature['General Titles']?.toLowerCase() || ''
        if (category) {
          categoryCounts[category] = (categoryCounts[category] || 0) + 1
        }
      })
      setSymptomCounts(categoryCounts)
      
      // Calculate top features by occurrence
      const featureCounts = new Map<string, { count: number; category: string }>()
      features.forEach(feature => {
        const featureName = feature['Ciliopathy / Clinical Features']
        const category = feature.Category || feature['General Titles'] || 'Other'
        if (featureName) {
          const existing = featureCounts.get(featureName)
          if (existing) {
            existing.count++
          } else {
            featureCounts.set(featureName, { count: 1, category })
          }
        }
      })
      
      const topFeatures = Array.from(featureCounts.entries())
        .map(([feature, data]) => ({ feature, count: data.count, category: data.category }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8)
      
      setTopFeaturesData(topFeatures)
    } catch (error) {
      console.error('Failed to load data:', error)
    }
  }

  const performDiseaseDropdownSearch = async (disease: string) => {
    setIsSearching(true)
    try {
      const results = await dataService.getCiliopathyFeatures()
      const filtered = results.filter(f => f.Disease === disease)
      setSearchResults(filtered)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Load suggestions as user types (using pre-loaded data)
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSuggestions([])
      return
    }

    try {
      const query = debouncedSearchQuery.toLowerCase()
      
      // Show more suggestions for single-letter searches
      const maxSuggestions = query.length === 1 ? 15 : 10
      
      if (activeTab === 'disease') {
        // Show disease suggestions that START with the query
        const filtered = availableDiseases
          .filter(d => d.toLowerCase().startsWith(query))
          .slice(0, maxSuggestions)
        setSuggestions(filtered)
      } else {
        // Show symptom suggestions that START with the query
        const filtered = clinicalFeatures
          .filter(f => f.toLowerCase().startsWith(query))
          .slice(0, maxSuggestions)
        setSuggestions(filtered)
      }
    } catch (error) {
      console.error('Failed to load suggestions:', error)
      setSuggestions([])
    }
  }, [debouncedSearchQuery, activeTab, availableDiseases, clinicalFeatures])

  // Search only when explicitly called
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      if (!selectedDisease) {
        setSearchResults([])
      }
      return
    }

    setIsSearching(true)
    try {
      let results: CiliopathyFeature[] = []
      
      if (activeTab === 'disease') {
        // Search by disease name
        results = await dataService.getCiliopathyFeatures()
        results = results.filter(f => 
          f.Disease?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      } else {
        // Search by clinical feature
        results = await dataService.getCiliopathyFeatures()
        results = results.filter(f => 
          f['Ciliopathy / Clinical Features']?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }
      
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, activeTab, selectedDisease])

  const handleDownload = useCallback((format: 'csv' | 'json') => {
    if (format === 'csv') {
      downloadCSV(searchResults, `symptoms_search_${searchQuery}.csv`)
    } else {
      downloadJSON(searchResults, `symptoms_search_${searchQuery}.json`)
    }
  }, [searchResults, searchQuery])

  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setSuggestions([])
    setSelectedDisease('')
    setIsSearching(false)
  }, [])

  // Disease symptom summary data with icon mapping
  const iconMap: { [key: string]: { icon: React.ComponentType<{ className?: string }>, color: string } } = {
    aural: { icon: Eye, color: 'text-blue-500' },
    auditory: { icon: Eye, color: 'text-blue-500' },
    neural: { icon: Brain, color: 'text-purple-500' },
    neurological: { icon: Brain, color: 'text-purple-500' },
    ophthalmic: { icon: Eye, color: 'text-green-500' },
    ocular: { icon: Eye, color: 'text-green-500' },
    skeletal: { icon: Activity, color: 'text-orange-500' },
    respiratory: { icon: Activity, color: 'text-red-500' },
    hormonal: { icon: Zap, color: 'text-yellow-500' },
    endocrine: { icon: Zap, color: 'text-yellow-500' },
    reproductive: { icon: Users, color: 'text-pink-500' },
    facial: { icon: Users, color: 'text-indigo-500' },
    cerebral: { icon: Brain, color: 'text-gray-500' },
    renal: { icon: CircleDot, color: 'text-cyan-500' },
    kidney: { icon: CircleDot, color: 'text-cyan-500' },
    coronary: { icon: Heart, color: 'text-red-600' },
    cardiac: { icon: Heart, color: 'text-red-600' },
    nasal: { icon: CircleDot, color: 'text-blue-600' },
    liver: { icon: CircleDot, color: 'text-green-600' },
    hepatic: { icon: CircleDot, color: 'text-green-600' },
    cognitive: { icon: Brain, color: 'text-purple-600' },
    digestive: { icon: CircleDot, color: 'text-orange-600' },
    organ: { icon: Activity, color: 'text-gray-600' }
  }
  
  // Build disease symptom summary from real data
  const diseaseSymptomSummary = Object.entries(symptomCounts)
    .slice(0, 16) // Limit to top 16 categories
    .reduce((acc, [key, count]) => {
      const iconData = iconMap[key.toLowerCase()] || { icon: Activity, color: 'text-gray-500' }
      acc[key] = { count, ...iconData }
      return acc
    }, {} as { [key: string]: { count: number; icon: React.ComponentType<{ className?: string }>; color: string } })

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Symptoms and Diseases
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore clinical features and their relationships to ciliopathy diseases. 
            Search by disease name or clinical symptoms with advanced filtering options.
          </p>
        </div>

        {/* Search Options */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Search Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose Search Option
              </label>
              <div className="flex space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="disease"
                    checked={activeTab === 'disease'}
                    onChange={(e) => setActiveTab(e.target.value as 'disease' | 'symptom')}
                    className="mr-2"
                  />
                  Disease Based
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="symptom"
                    checked={activeTab === 'symptom'}
                    onChange={(e) => setActiveTab(e.target.value as 'disease' | 'symptom')}
                    className="mr-2"
                  />
                  Symptoms Based
                </label>
              </div>
            </div>

            <div />
          </div>

          {/* Disease Selection (for disease-based search) */}
          {activeTab === 'disease' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose a Disease
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedDisease}
                  onChange={(e) => setSelectedDisease(e.target.value)}
                  className="flex-1 px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                >
                  <option value="">Select a disease...</option>
                  {availableDiseases.map(disease => (
                    <option key={disease} value={disease}>
                      {disease}
                    </option>
                  ))}
                </select>
                {selectedDisease && (
                  <button
                    onClick={() => {
                      setSelectedDisease('')
                      setSearchResults([])
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Clear
                  </button>
                )}
              </div>
              {selectedDisease && !isSearching && (
                <div className="mt-2 text-sm text-gray-600">
                  Found <span className="font-semibold text-primary">{searchResults.length}</span> clinical feature(s) for <span className="font-semibold">{selectedDisease}</span>
                </div>
              )}
              {isSearching && selectedDisease && (
                <div className="mt-2 text-sm text-gray-500">
                  Loading features for {selectedDisease}...
                </div>
              )}
            </div>
          )}

          {/* Search Input */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {activeTab === 'disease' ? 'Search by Disease Name' : 'Search by Symptom Name'}
            </label>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              placeholder={activeTab === 'disease' ? 'Enter disease name...' : 'Enter symptom name...'}
              isLoading={isSearching}
              suggestions={suggestions}
            />
          </div>
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-700 text-lg">Searching...</p>
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <SearchResults
              results={searchResults}
              type="feature"
              onDownload={handleDownload}
              onClear={handleClearSearch}
            />
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchQuery && !selectedDisease && searchResults.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No results found
            </h3>
            <p className="text-gray-600">
              Try a different search term or browse our database sections.
            </p>
          </div>
        )}

        {/* Disease Symptom Summary */}
        {hasFeatureData ? (
          <>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                Disease Symptom Summary
              </h3>
              <div className="grid grid-cols-4 gap-4">
                {Object.entries(diseaseSymptomSummary).map(([key, data]) => {
                  const IconComponent = data.icon
                  return (
                    <div key={key} className="text-center p-4 border border-gray-200 rounded-lg">
                      <IconComponent className={`h-8 w-8 ${data.color} mx-auto mb-2`} />
                      <div className="text-lg font-semibold text-gray-900">{data.count}</div>
                      <div className="text-sm text-gray-600 capitalize">{key}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{clinicalFeatures.length.toLocaleString()}</div>
                <div className="text-sm text-gray-600">Unique Clinical Features</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{availableDiseases.length}</div>
                <div className="text-sm text-gray-600">Ciliopathy Diseases</div>
              </div>
              <div className="bg-white rounded-lg shadow-lg p-6 text-center">
                <Filter className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">{Object.keys(symptomCounts).length}</div>
                <div className="text-sm text-gray-600">Organ Systems</div>
              </div>
            </div>

            {/* Top Clinical Features */}
            {topFeaturesData.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Top Clinical Features
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {topFeaturesData.map((feature, index) => (
                    <div key={index} className="p-4 border border-gray-200 rounded-lg">
                      <div className="text-lg font-semibold text-gray-900">{feature.feature}</div>
                      <div className="text-sm text-gray-600">{feature.category}</div>
                      <div className="text-2xl font-bold text-primary">{feature.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
            <Activity className="h-10 w-10 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-amber-800 mb-2">Clinical Feature Data Not Yet Available</h3>
            <p className="text-amber-700 text-sm max-w-xl mx-auto">
              The symptom and clinical feature data sheets (<code className="bg-amber-100 px-1 rounded">symptome_primary</code>, <code className="bg-amber-100 px-1 rounded">symptome_secondary</code>) have not been added to the database yet.
              Once available, disease-symptom relationships, organ system summaries, and clinical feature search will be fully functional.
            </p>
          </div>
        )}

        {/* Information Box */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            About Clinical Features Search
          </h3>
          <div className="text-blue-700 space-y-2">
            <p>
              This page allows you to search for ciliopathy diseases based on clinical features 
              or search for clinical features associated with specific diseases.
            </p>
            <p>
              <strong>Disease Based Search:</strong> Choose a disease and see all associated clinical features.
            </p>
            <p>
              <strong>Symptoms Based Search:</strong> Search for symptoms to find associated ciliopathy diseases.
            </p>
            <p>
              <strong>Data Source:</strong> Clinical feature data is loaded from the <code>symptome_primary</code> and <code>symptome_secondary</code> sheets in the database.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
