'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults, OrthologResults } from '@/components/SearchComponents'
import { CiliopathyGene, OrthologGene } from '@/types'
import { dataService } from '@/services/dataService'
import { downloadCSV, downloadJSON, useDebounce } from '@/lib/utils'
import { Activity, Search, Globe, Database, Mouse, Fish, Zap, Bug, Circle, Leaf, Users } from 'lucide-react'

export default function GenesOrthologsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrganism, setSelectedOrganism] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<OrthologGene[]>([])
  const [geneResults, setGeneResults] = useState<CiliopathyGene[]>([])
  const [isSearchingGenes, setIsSearchingGenes] = useState(false)
  const [isSearchingOrthologs, setIsSearchingOrthologs] = useState(false)
  const [organismStats, setOrganismStats] = useState<Record<string, number>>({})
  const [searchMode, setSearchMode] = useState<'gene' | 'ortholog'>('gene')
  const [selectedOrganismData, setSelectedOrganismData] = useState<OrthologGene[]>([])
  const [isLoadingOrganismData, setIsLoadingOrganismData] = useState(false)
  const [cachedGenes, setCachedGenes] = useState<CiliopathyGene[]>([])
  const [totalOrthologs, setTotalOrthologs] = useState(0)
  const [uniqueDiseases, setUniqueDiseases] = useState(0)

  // Debounce search query with 300ms delay for suggestions
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Organism configurations with icons
  const organismsConfig = [
    {
      id: 'homo_sapiens',
      name: 'Homo sapiens',
      commonName: 'Human',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Reference species for ciliopathy research'
    },
    {
      id: 'mus_musculus',
      name: 'Mus musculus',
      commonName: 'Mouse',
      icon: Mouse,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Primary mammalian model organism'
    },
    {
      id: 'danio_rerio',
      name: 'Danio rerio',
      commonName: 'Zebrafish',
      icon: Fish,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Aquatic model for developmental studies'
    },
    {
      id: 'xenopus_laevis',
      name: 'Xenopus laevis',
      commonName: 'Frog',
      icon: Zap,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      description: 'Amphibian model for ciliary development'
    },
    {
      id: 'drosophila_melanogaster',
      name: 'Drosophila melanogaster',
      commonName: 'Fruit Fly',
      icon: Bug,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Invertebrate model for ciliary function'
    },
    {
      id: 'caenorhabditis_elegans',
      name: 'Caenorhabditis elegans',
      commonName: 'Worm',
      icon: Circle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Nematode model for sensory cilia'
    },
    {
      id: 'chlamydomonas_reinhardtii',
      name: 'Chlamydomonas reinhardtii',
      commonName: 'Green Algae',
      icon: Leaf,
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      description: 'Unicellular model for flagella/cilia'
    }
  ]

  const organisms = [
    { id: 'all', name: 'All Organisms', count: 0 },
    ...organismsConfig.map(org => ({
      id: org.id,
      name: org.name,
      count: organismStats[org.id] || 0
    }))
  ]

  // Load organism statistics and genes on component mount
  useEffect(() => {
    loadOrganismStats()
    loadGenesForSuggestions()
  }, [])

  const loadGenesForSuggestions = async () => {
    try {
      const genes = await dataService.getCiliopathyGenes()
      setCachedGenes(genes)
      const diseases = new Set(genes.map(g => g.Ciliopathy).filter(Boolean))
      setUniqueDiseases(diseases.size)
    } catch (error) {
      console.error('Failed to load genes for suggestions:', error)
    }
  }

  const loadOrganismStats = async () => {
    try {
      const stats = await Promise.all(
        organismsConfig.map(org => dataService.getOrganismStats(org.id))
      )
      
      const statsMap: Record<string, number> = {}
      let total = 0
      organismsConfig.forEach((org, idx) => {
        statsMap[org.id] = stats[idx].geneCount
        total += stats[idx].geneCount
      })
      
      setOrganismStats(statsMap)
      setTotalOrthologs(total)
    } catch (error) {
      console.error('Failed to load organism stats:', error)
    }
  }

  // Load organism-specific data when organism is selected
  const loadOrganismData = async (organismId: string) => {
    if (organismId === 'all' || organismId === 'homo_sapiens') {
      setSelectedOrganismData([])
      return
    }
    
    setIsLoadingOrganismData(true)
    try {
      const data = await dataService.getOrthologData(organismId)
      setSelectedOrganismData(data.slice(0, 50)) // Show first 50 for preview
    } catch (error) {
      console.error('Failed to load organism data:', error)
      setSelectedOrganismData([])
    } finally {
      setIsLoadingOrganismData(false)
    }
  }

  // Automatically load data when organism changes
  useEffect(() => {
    if (selectedOrganism !== 'all') {
      loadOrganismData(selectedOrganism)
    }
  }, [selectedOrganism])

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

  // Search genes only when explicitly called
  const handleGeneSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setGeneResults([])
      return
    }

    setIsSearchingGenes(true)
    try {
      const results = await dataService.searchCiliopathyGenes(searchQuery)
      setGeneResults(results)
    } catch (error) {
      console.error('Gene search failed:', error)
      setGeneResults([])
    } finally {
      setIsSearchingGenes(false)
    }
  }, [searchQuery])

  // Search orthologs only when explicitly called
  const handleOrthologSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    setIsSearchingOrthologs(true)
    try {
      const allOrthologs: OrthologGene[] = []
      
      if (selectedOrganism === 'all') {
        const organismIds = organismsConfig.map(o => o.id).filter(id => id !== 'homo_sapiens')
        
        for (const org of organismIds) {
          try {
            const orthologs = await dataService.getOrthologData(org)
            const filtered = orthologs.filter(orth => 
              orth['Human Gene Name']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              orth['Ortholog Gene Name']?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            allOrthologs.push(...filtered)
          } catch (error) {
            console.error(`Failed to load orthologs for ${org}:`, error)
          }
        }
      } else {
        const orthologs = await dataService.getOrthologData(selectedOrganism)
        const filtered = orthologs.filter(orth => 
          orth['Human Gene Name']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          orth['Ortholog Gene Name']?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        allOrthologs.push(...filtered)
      }
      
      setSearchResults(allOrthologs)
    } catch (error) {
      console.error('Ortholog search failed:', error)
      setSearchResults([])
    } finally {
      setIsSearchingOrthologs(false)
    }
  }, [searchQuery, selectedOrganism])

  const handleGeneDownload = useCallback((format: 'csv' | 'json') => {
    if (format === 'csv') {
      downloadCSV(geneResults, `gene_search_${searchQuery}.csv`)
    } else {
      downloadJSON(geneResults, `gene_search_${searchQuery}.json`)
    }
  }, [geneResults, searchQuery])

  const handleOrthologDownload = useCallback((format: 'csv' | 'json') => {
    if (format === 'csv') {
      downloadCSV(searchResults, `ortholog_search_${searchQuery}.csv`)
    } else {
      downloadJSON(searchResults, `ortholog_search_${searchQuery}.json`)
    }
  }, [searchResults, searchQuery])

  const handleClearGeneSearch = useCallback(() => {
    setSearchQuery('')
    setGeneResults([])
    setSuggestions([])
    setIsSearchingGenes(false)
  }, [])

  const handleClearOrthologSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults([])
    setSuggestions([])
    setIsSearchingOrthologs(false)
  }, [])

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ciliopathy Genes & Orthologs
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore ciliopathy-associated genes and their orthologs across different model organisms
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{cachedGenes.length.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Human Genes</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Globe className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{organismsConfig.length}</div>
            <div className="text-sm text-gray-600">Organisms</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Database className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{totalOrthologs.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Orthologs</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Search className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">{uniqueDiseases}</div>
            <div className="text-sm text-gray-600">Diseases</div>
          </div>
        </div>

        {/* Gene Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Gene Search</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Human Genes
            </label>
            <SearchInput
              placeholder="Search by gene name, ID, or MIM number..."
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value)
                setSearchMode('gene')
              }}
              onSearch={handleGeneSearch}
              isLoading={isSearchingGenes}
              suggestions={suggestions}
            />
          </div>

          {isSearchingGenes && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Searching genes...</p>
            </div>
          )}

          {geneResults.length > 0 && (
            <div className="mt-6">
              <SearchResults
                results={geneResults}
                type="gene"
                onDownload={handleGeneDownload}
                onClear={handleClearGeneSearch}
              />
            </div>
          )}
        </div>

        {/* Organism Selection */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Select Organism</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {organisms.map((organism) => (
              <button
                key={organism.id}
                onClick={() => setSelectedOrganism(organism.id)}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  selectedOrganism === organism.id
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 hover:border-primary hover:bg-gray-50'
                }`}
              >
                <div className="text-lg font-semibold">{organism.name}</div>
                <div className="text-sm opacity-75">{organism.count} genes</div>
              </button>
            ))}
          </div>
        </div>

        {/* Ortholog Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Ortholog Search</h2>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Orthologs
            </label>
            <SearchInput
              placeholder="Search by gene name or disease..."
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value)
                setSearchMode('ortholog')
              }}
              onSearch={handleOrthologSearch}
              isLoading={isSearchingOrthologs}
              suggestions={suggestions}
            />
          </div>

          {isSearchingOrthologs && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Searching orthologs...</p>
            </div>
          )}

          {searchResults.length > 0 && (
            <div className="mt-6">
              <OrthologResults
                results={searchResults}
                onDownload={handleOrthologDownload}
                onClear={handleClearOrthologSearch}
              />
            </div>
          )}
        </div>

        {/* Organism Browser Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Browse by Organism</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {organismsConfig.map((organism) => {
              const IconComponent = organism.icon
              return (
                <div
                  key={organism.id}
                  className={`${organism.bgColor} rounded-lg p-6 border-2 ${
                    selectedOrganism === organism.id ? 'border-primary' : 'border-transparent'
                  } hover:border-primary transition-all cursor-pointer`}
                  onClick={() => setSelectedOrganism(organism.id)}
                >
                  <div className="flex items-start space-x-4">
                    <IconComponent className={`h-12 w-12 ${organism.color} flex-shrink-0`} />
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-1">
                        {organism.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{organism.commonName}</p>
                      <p className="text-sm text-gray-700 mb-3">{organism.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold text-gray-900">
                          {organismStats[organism.id] || 0} genes
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Display organism data if loaded */}
          {isLoadingOrganismData && (
            <div className="mt-6 text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading organism data...</p>
            </div>
          )}

          {!isLoadingOrganismData && selectedOrganismData.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {organismsConfig.find(o => o.id === selectedOrganism)?.name} - Sample Orthologs (50 shown)
              </h3>
              <OrthologResults
                results={selectedOrganismData}
                onDownload={(format) => {
                  if (format === 'csv') {
                    downloadCSV(selectedOrganismData, `${selectedOrganism}_orthologs.csv`)
                  } else {
                    downloadJSON(selectedOrganismData, `${selectedOrganism}_orthologs.json`)
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* Data Sources */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Data Sources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">ConVarT</h3>
              <p className="text-sm text-gray-600">
                Conservation and variation analysis of orthologs
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">OrthoList 2</h3>
              <p className="text-sm text-gray-600">
                Comprehensive ortholog database for model organisms
              </p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">WormBase</h3>
              <p className="text-sm text-gray-600">
                C. elegans genome and biology database
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
