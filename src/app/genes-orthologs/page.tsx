'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults, OrthologResults } from '@/components/SearchComponents'
import { CiliopathyGene, OrthologGene } from '@/types'
import { dataService } from '@/services/dataService'
import { downloadCSV, downloadJSON } from '@/lib/utils'
import { Activity, Search, Globe, Database } from 'lucide-react'

export default function GenesOrthologsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedOrganism, setSelectedOrganism] = useState<string>('all')
  const [searchResults, setSearchResults] = useState<OrthologGene[]>([])
  const [geneResults, setGeneResults] = useState<CiliopathyGene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [organismStats, setOrganismStats] = useState<Record<string, number>>({})

  const organisms = [
    { id: 'all', name: 'All Organisms', count: 0 },
    { id: 'homo_sapiens', name: 'Homo sapiens', count: organismStats.homo_sapiens || 0 },
    { id: 'mus_musculus', name: 'Mus musculus', count: organismStats.mus_musculus || 0 },
    { id: 'danio_rerio', name: 'Danio rerio', count: organismStats.danio_rerio || 0 },
    { id: 'xenopus_laevis', name: 'Xenopus laevis', count: organismStats.xenopus_laevis || 0 },
    { id: 'drosophila_melanogaster', name: 'Drosophila melanogaster', count: organismStats.drosophila_melanogaster || 0 },
    { id: 'caenorhabditis_elegans', name: 'Caenorhabditis elegans', count: organismStats.caenorhabditis_elegans || 0 },
    { id: 'chlamydomonas_reinhardtii', name: 'Chlamydomonas reinhardtii', count: organismStats.chlamydomonas_reinhardtii || 0 }
  ]

  // Load organism statistics on component mount
  useEffect(() => {
    loadOrganismStats()
  }, [])

  const loadOrganismStats = async () => {
    try {
      const stats = await Promise.all([
        dataService.getOrganismStats('homo_sapiens'),
        dataService.getOrganismStats('mus_musculus'),
        dataService.getOrganismStats('danio_rerio'),
        dataService.getOrganismStats('xenopus_laevis'),
        dataService.getOrganismStats('drosophila_melanogaster'),
        dataService.getOrganismStats('caenorhabditis_elegans'),
        dataService.getOrganismStats('chlamydomonas_reinhardtii')
      ])
      
      setOrganismStats({
        homo_sapiens: stats[0].geneCount,
        mus_musculus: stats[1].geneCount,
        danio_rerio: stats[2].geneCount,
        xenopus_laevis: stats[3].geneCount,
        drosophila_melanogaster: stats[4].geneCount,
        caenorhabditis_elegans: stats[5].geneCount,
        chlamydomonas_reinhardtii: stats[6].geneCount
      })
    } catch (error) {
      console.error('Failed to load organism stats:', error)
    }
  }

  const performGeneSearch = async () => {
    if (!searchQuery.trim()) {
      setGeneResults([])
      return
    }
    
    setIsLoading(true)
    try {
      const results = await dataService.searchCiliopathyGenes(searchQuery)
      setGeneResults(results)
    } catch (error) {
      console.error('Gene search failed:', error)
      setGeneResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const performOrthologSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    
    setIsLoading(true)
    try {
      // Search across all organisms for orthologs
      const allOrthologs: OrthologGene[] = []
      
      if (selectedOrganism === 'all') {
        // Search all organisms
        const organisms = ['mus_musculus', 'danio_rerio', 'xenopus_laevis', 'drosophila_melanogaster', 'caenorhabditis_elegans', 'chlamydomonas_reinhardtii']
        
        for (const org of organisms) {
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
        // Search specific organism
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
      setIsLoading(false)
    }
  }

  const handleGeneDownload = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      downloadCSV(geneResults, `gene_search_${searchQuery}.csv`)
    } else {
      downloadJSON(geneResults, `gene_search_${searchQuery}.json`)
    }
  }

  const handleOrthologDownload = (format: 'csv' | 'json') => {
    if (format === 'csv') {
      downloadCSV(searchResults, `ortholog_search_${searchQuery}.csv`)
    } else {
      downloadJSON(searchResults, `ortholog_search_${searchQuery}.json`)
    }
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Ciliopathy Genes and Orthologs
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore ciliopathy-associated genes and their orthologs across different model organisms.
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Activity className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">513</div>
            <div className="text-sm text-gray-600">Human Genes</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Globe className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">7</div>
            <div className="text-sm text-gray-600">Organisms</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Database className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">2,889</div>
            <div className="text-sm text-gray-600">Total Orthologs</div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Search className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">55</div>
            <div className="text-sm text-gray-600">Diseases</div>
          </div>
        </div>

        {/* Gene Search Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Gene Search</h2>
          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Human Genes
              </label>
              <SearchInput
                placeholder="Search by gene name, ID, or MIM number"
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={performGeneSearch}
              />
            </div>
            <button
              onClick={performGeneSearch}
              className="btn-primary px-6 py-3"
            >
              Search Genes
            </button>
          </div>

          {geneResults.length > 0 && (
            <div className="mb-6">
              <SearchResults
                results={geneResults}
                type="gene"
                onDownload={handleGeneDownload}
              />
            </div>
          )}
        </div>

        {/* Organism Selection */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Organism Selection</h2>
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
          <div className="flex gap-4 items-end mb-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Orthologs
              </label>
              <SearchInput
                placeholder="Search by gene name or disease"
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={performOrthologSearch}
              />
            </div>
            <button
              onClick={performOrthologSearch}
              className="btn-primary px-6 py-3"
            >
              Search Orthologs
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mb-6">
              <OrthologResults
                results={searchResults}
                onDownload={handleOrthologDownload}
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
