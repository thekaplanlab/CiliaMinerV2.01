'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { SearchInput, SearchResults, TabPanel } from '@/components/SearchComponents'
import { BarPlot, CiliaMinerPieChart, BubbleChart, ChartGrid, StatCard } from '@/components/ChartComponents'
import { CiliopathyGene, CiliopathyFeature, BarPlotData, GeneNumber, PublicationData } from '@/types'
import { dataService } from '@/services/dataService'
import { 
  Search, 
  Database, 
  Activity, 
  TrendingUp,
  Users,
  FileText,
  Globe,
  Award
} from 'lucide-react'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('genes')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CiliopathyGene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [barPlotData, setBarPlotData] = useState<BarPlotData[]>([])
  const [pieChartData, setPieChartData] = useState<GeneNumber[]>([])
  const [publicationData, setPublicationData] = useState<PublicationData[]>([])
  const [stats, setStats] = useState({
    totalGenes: 0,
    totalCiliopathies: 0,
    totalPublications: 0,
    totalOrganisms: 6
  })

  // Load real data on component mount with progressive loading
  useEffect(() => {
    loadRealData()
  }, [])

  const loadRealData = async () => {
    try {
      console.log('Starting to load real data...')
      setIsDataLoading(true)
      
      // Load data progressively with individual loading states
      const loadPromises = [
        loadGenesData(),
        loadChartData(),
        loadPublicationData()
      ]

      // Wait for all data to load
      await Promise.all(loadPromises)
      console.log('All data loaded successfully')

    } catch (error) {
      console.error('Failed to load real data:', error)
    } finally {
      setIsDataLoading(false)
    }
  }

  const loadGenesData = async () => {
    try {
      console.log('Loading genes data...')
      const genes = await dataService.getCiliopathyGenes()
      console.log(`Loaded ${genes.length} genes`)
      // Calculate statistics
      setStats({
        totalGenes: genes.length,
        totalCiliopathies: new Set(genes.map(g => g.Ciliopathy)).size,
        totalPublications: stats.totalPublications,
        totalOrganisms: 6
      })
    } catch (error) {
      console.error('Failed to load genes data:', error)
    }
  }

  const loadChartData = async () => {
    try {
      const [geneNumbers, barPlot] = await Promise.all([
        dataService.getGeneNumbers(),
        dataService.getBarPlotData()
      ])
      setBarPlotData(barPlot)
      setPieChartData(geneNumbers)
    } catch (error) {
      console.error('Failed to load chart data:', error)
    }
  }

  const loadPublicationData = async () => {
    try {
      const publications = await dataService.getPublicationData()
      setPublicationData(publications)
      // Calculate total publications by summing all publication_number values
      const totalPubs = publications.reduce((sum, pub) => sum + pub.publication_number, 0)
      setStats(prev => ({
        ...prev,
        totalPublications: totalPubs
      }))
    } catch (error) {
      console.error('Failed to load publication data:', error)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    
    setIsLoading(true)
    try {
      const results = await dataService.searchCiliopathyGenes(searchQuery)
      setSearchResults(results)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
  }

  const handleDownloadResults = (format: 'csv' | 'json') => {
    if (searchResults.length === 0) return
    
    if (format === 'csv') {
      const csvContent = [
        ['Gene Name', 'Ciliopathy', 'Subcellular Localization', 'Gene MIM Number'],
        ...searchResults.map(gene => [
          gene['Human Gene Name'] || '',
          gene.Ciliopathy || '',
          gene['Subcellular Localization'] || '',
          gene['Gene MIM Number'] || ''
        ])
      ].map(row => row.join(',')).join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ciliaminer_search_results_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
    } else if (format === 'json') {
      const jsonContent = JSON.stringify(searchResults, null, 2)
      const blob = new Blob([jsonContent], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ciliaminer_search_results_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  }

  const tabs = [
    { id: 'genes', label: 'Genes', count: stats.totalGenes },
    { id: 'ciliopathies', label: 'Ciliopathies', count: stats.totalCiliopathies }
  ]

  return (
    <Layout>
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-5xl font-bold mb-6">
              CiliaMiner
            </h1>
            <p className="text-xl mb-8 max-w-3xl mx-auto">
              A comprehensive database for ciliopathy research, providing access to gene data, 
              orthologs, and clinical features across multiple model organisms.
            </p>
            
            {/* Search Section */}
            <div className="max-w-2xl mx-auto">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                placeholder="Search by Gene Name, Disease, or Gene ID..."
                suggestions={[
                  'Bardet-Biedl Syndrome',
                  'Polycystic Kidney Disease',
                  'Joubert Syndrome',
                  'PKD1',
                  'BBS1',
                  'Cilia',
                  'Retinal Degeneration'
                ]}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-700 text-lg">Searching across all data...</p>
          </div>
        </div>
      )}

      {/* No Results */}
      {searchQuery && !isLoading && searchResults.length === 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <Search className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              No results found
            </h3>
            <p className="text-gray-600">
              Try a different search term or browse our database sections.
            </p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && !isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-12">
          <SearchResults
            results={searchResults}
            type="gene"
            onDownload={handleDownloadResults}
            onClear={handleClearSearch}
          />
        </div>
      )}

      {/* Statistics Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Genes"
            value={isDataLoading ? '...' : stats.totalGenes.toLocaleString()}
            icon={Database}
            color="blue"
          />
          <StatCard
            title="Ciliopathies"
            value={isDataLoading ? '...' : stats.totalCiliopathies.toLocaleString()}
            icon={Activity}
            color="green"
          />
          <StatCard
            title="Publications"
            value={isDataLoading ? '...' : stats.totalPublications.toLocaleString()}
            icon={FileText}
            color="purple"
          />
          <StatCard
            title="Model Organisms"
            value={stats.totalOrganisms.toString()}
            icon={Globe}
            color="orange"
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Bar Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Gene Distribution by Localization
            </h3>
            {isDataLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <BarPlot
                data={barPlotData}
                height={300}
                title="Gene Distribution by Localization"
              />
            )}
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">
              Ciliopathy Categories
            </h3>
            {isDataLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <CiliaMinerPieChart
                data={pieChartData}
                height={300}
                title="Ciliopathy Categories"
              />
            )}
          </div>
        </div>
      </div>

      {/* Bubble Chart Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
            Publication Numbers of Ciliopathy Related Genes (2000-2024)
          </h3>
          {isDataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <BubbleChart
              data={publicationData.map(pub => ({
                year: pub.year,
                count: pub.publication_number,
                gene: pub.gene_name
              }))}
              title="Publication Numbers Over Time"
            />
          )}
        </div>
      </div>

      {/* Top Genes by Publications */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">
            Top Genes by Publication Count
          </h3>
          {isDataLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {(() => {
                // Aggregate publication counts by gene
                const genePublicationMap = new Map<string, number>()
                publicationData.forEach(pub => {
                  const current = genePublicationMap.get(pub.gene_name) || 0
                  genePublicationMap.set(pub.gene_name, current + pub.publication_number)
                })
                
                // Sort by publication count and get top 10
                const topGenes = Array.from(genePublicationMap.entries())
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 10)
                
                return topGenes.map(([gene, count], index) => (
                  <div key={index} className="flex items-center justify-between border-b border-gray-200 pb-3 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-white font-semibold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{gene}</h4>
                        <p className="text-sm text-gray-500">Ciliopathy-related gene</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{count.toLocaleString()}</div>
                      <p className="text-xs text-gray-500">publications</p>
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">
            Explore CiliaMiner Features
          </h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            Discover comprehensive data on ciliopathy genes, orthologs, and clinical features
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Search className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Gene Search</h3>
            <p className="text-gray-600">
              Search through thousands of ciliopathy genes with advanced filtering options
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <TrendingUp className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Ortholog Analysis</h3>
            <p className="text-gray-600">
              Explore gene orthologs across multiple model organisms
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Users className="h-12 w-12 text-purple-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Clinical Features</h3>
            <p className="text-gray-600">
              Access comprehensive clinical feature data and disease associations
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
