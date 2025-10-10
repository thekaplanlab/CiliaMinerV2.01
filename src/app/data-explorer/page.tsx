'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { CiliopathyGene, CiliopathyFeature, OrthologGene } from '@/types'
import { 
  Search, 
  Download, 
  Database, 
  Eye, 
  Activity, 
  Filter, 
  X, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart3,
  PieChart,
  TrendingUp
} from 'lucide-react'
import { BarPlot, CiliaMinerPieChart } from '@/components/ChartComponents'

interface TableData {
  genes: CiliopathyGene[]
  features: CiliopathyFeature[]
  orthologs: OrthologGene[]
}

interface SortConfig {
  key: string
  direction: 'asc' | 'desc'
}

interface FilterState {
  search: string
  disease: string
  organism: string
  localization: string
  symptomCategory: string
  minCount: number
  maxCount: number
}

export default function DataExplorerPage() {
  const [data, setData] = useState<TableData>({ genes: [], features: [], orthologs: [] })
  const [filteredData, setFilteredData] = useState<TableData>({ genes: [], features: [], orthologs: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'genes' | 'features' | 'orthologs'>('genes')
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: '', direction: 'asc' })
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    disease: '',
    organism: '',
    localization: '',
    symptomCategory: '',
    minCount: 0,
    maxCount: 1000
  })
  const [showFilters, setShowFilters] = useState(false)
  const [showCharts, setShowCharts] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(25)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFiltersAndSort()
  }, [data, filters, sortConfig])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [genes, features, orthologs] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getCiliopathyFeatures(),
        dataService.getAllOrthologData()
      ])
      
      setData({ genes, features, orthologs })
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const applyFiltersAndSort = () => {
    let filtered = { ...data }

    // Apply search filter
    if (filters.search) {
      const query = filters.search.toLowerCase()
      filtered.genes = data.genes.filter(g => 
        g['Human Gene Name']?.toLowerCase().includes(query) ||
        g['Human Gene ID']?.toLowerCase().includes(query) ||
        g.Ciliopathy?.toLowerCase().includes(query)
      )
      filtered.features = data.features.filter(f => 
        f.Disease?.toLowerCase().includes(query) ||
        f.Category?.toLowerCase().includes(query) ||
        f.Feature?.toLowerCase().includes(query)
      )
      filtered.orthologs = data.orthologs.filter(o => 
        o['Human Gene']?.toLowerCase().includes(query) ||
        o['Ortholog Gene']?.toLowerCase().includes(query) ||
        o['Human Disease']?.toLowerCase().includes(query)
      )
    }

    // Apply disease filter
    if (filters.disease) {
      filtered.genes = filtered.genes.filter(g => g.Ciliopathy?.toLowerCase().includes(filters.disease.toLowerCase()))
      filtered.features = filtered.features.filter(f => f.Disease?.toLowerCase().includes(filters.disease.toLowerCase()))
      filtered.orthologs = filtered.orthologs.filter(o => o['Human Disease']?.toLowerCase().includes(filters.disease.toLowerCase()))
    }

    // Apply organism filter
    if (filters.organism) {
      filtered.orthologs = filtered.orthologs.filter(o => o.Organism?.toLowerCase().includes(filters.organism.toLowerCase()))
    }

    // Apply localization filter
    if (filters.localization) {
      filtered.genes = filtered.genes.filter(g => g['Subcellular Localization']?.toLowerCase().includes(filters.localization.toLowerCase()))
    }

    // Apply symptom category filter
    if (filters.symptomCategory) {
      filtered.features = filtered.features.filter(f => f.Category?.toLowerCase().includes(filters.symptomCategory.toLowerCase()))
    }

    // Apply count range filter
    if (filters.minCount > 0 || filters.maxCount < 1000) {
      filtered.features = filtered.features.filter(f => 
        (f.Count || 0) >= filters.minCount && (f.Count || 0) <= filters.maxCount
      )
    }

    // Apply sorting
    if (sortConfig.key) {
      const sortData = (arr: any[]) => {
        return [...arr].sort((a, b) => {
          const aVal = a[sortConfig.key] || ''
          const bVal = b[sortConfig.key] || ''
          
          if (sortConfig.direction === 'asc') {
            return aVal > bVal ? 1 : -1
          } else {
            return aVal < bVal ? 1 : -1
          }
        })
      }

      filtered.genes = sortData(filtered.genes)
      filtered.features = sortData(filtered.features)
      filtered.orthologs = sortData(filtered.orthologs)
    }

    setFilteredData(filtered)
    setCurrentPage(1)
  }

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
  }

  const clearFilters = () => {
    setFilters({
      search: '',
      disease: '',
      organism: '',
      localization: '',
      symptomCategory: '',
      minCount: 0,
      maxCount: 1000
    })
  }

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4" />
    return sortConfig.direction === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
  }

  const getCurrentData = () => {
    const data = filteredData[activeTab] || []
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return data.slice(startIndex, endIndex)
  }

  const getTotalPages = () => {
    const data = filteredData[activeTab] || []
    return Math.ceil(data.length / itemsPerPage)
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

  const getBarChartData = () => {
    if (activeTab === 'genes') {
      const diseaseCounts = filteredData.genes.reduce((acc, gene) => {
        const disease = gene.Ciliopathy || 'Unknown'
        acc[disease] = (acc[disease] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(diseaseCounts).map(([disease, count]) => ({
        name: disease,
        value: count
      })).sort((a, b) => b.value - a.value).slice(0, 10)
    }

    if (activeTab === 'features') {
      const categoryCounts = filteredData.features.reduce((acc, feature) => {
        const category = feature.Category || 'Unknown'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(categoryCounts).map(([category, count]) => ({
        name: category,
        value: count
      })).sort((a, b) => b.value - a.value).slice(0, 10)
    }

    if (activeTab === 'orthologs') {
      const organismCounts = filteredData.orthologs.reduce((acc, ortholog) => {
        const organism = ortholog.Organism || 'Unknown'
        acc[organism] = (acc[organism] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(organismCounts).map(([organism, count]) => ({
        name: organism,
        value: count
      })).sort((a, b) => b.value - a.value).slice(0, 10)
    }

    return []
  }

  const getPieChartData = () => {
    if (activeTab === 'genes') {
      const diseaseCounts = filteredData.genes.reduce((acc, gene) => {
        const disease = gene.Ciliopathy || 'Unknown'
        acc[disease] = (acc[disease] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(diseaseCounts).map(([disease, count]) => ({
        Disease: disease,
        Gene_numbers: count
      })).sort((a, b) => b.Gene_numbers - a.Gene_numbers).slice(0, 10)
    }

    if (activeTab === 'features') {
      const categoryCounts = filteredData.features.reduce((acc, feature) => {
        const category = feature.Category || 'Unknown'
        acc[category] = (acc[category] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(categoryCounts).map(([category, count]) => ({
        Disease: category,
        Gene_numbers: count
      })).sort((a, b) => b.Gene_numbers - a.Gene_numbers).slice(0, 10)
    }

    if (activeTab === 'orthologs') {
      const organismCounts = filteredData.orthologs.reduce((acc, ortholog) => {
        const organism = ortholog.Organism || 'Unknown'
        acc[organism] = (acc[organism] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return Object.entries(organismCounts).map(([organism, count]) => ({
        Disease: organism,
        Gene_numbers: count
      })).sort((a, b) => b.Gene_numbers - a.Gene_numbers).slice(0, 10)
    }

    return []
  }

  const getAvailableFilters = () => {
    const diseases = Array.from(new Set(data.genes.map(g => g.Ciliopathy).filter(Boolean))).sort()
    const organisms = Array.from(new Set(data.orthologs.map(o => o.Organism).filter(Boolean))).sort()
    const localizations = Array.from(new Set(data.genes.map(g => g['Subcellular Localization']).filter(Boolean))).sort()
    const symptomCategories = Array.from(new Set(data.features.map(f => f.Category).filter(Boolean))).sort()

    return { diseases, organisms, localizations, symptomCategories }
  }

  const availableFilters = getAvailableFilters()

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Data Explorer
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            Explore and analyze ciliopathy data with interactive tables, advanced filtering, 
            sorting, and data visualization. Download filtered results for further analysis.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    placeholder="Search across all data..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? 'Hide' : 'Show'} Filters
                </button>
                <button
                  onClick={() => setShowCharts(!showCharts)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
                >
                  <BarChart3 className="h-4 w-4" />
                  {showCharts ? 'Hide' : 'Show'} Charts
                </button>
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Disease
                  </label>
                  <select
                    value={filters.disease}
                    onChange={(e) => setFilters({ ...filters, disease: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Diseases</option>
                    {availableFilters.diseases.map(disease => (
                      <option key={disease} value={disease}>{disease}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organism
                  </label>
                  <select
                    value={filters.organism}
                    onChange={(e) => setFilters({ ...filters, organism: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Organisms</option>
                    {availableFilters.organisms.map(organism => (
                      <option key={organism} value={organism}>{organism}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Localization
                  </label>
                  <select
                    value={filters.localization}
                    onChange={(e) => setFilters({ ...filters, localization: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Localizations</option>
                    {availableFilters.localizations.map(localization => (
                      <option key={localization} value={localization}>{localization}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Symptom Category
                  </label>
                  <select
                    value={filters.symptomCategory}
                    onChange={(e) => setFilters({ ...filters, symptomCategory: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">All Categories</option>
                    {availableFilters.symptomCategories.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Count
                  </label>
                  <input
                    type="number"
                    value={filters.minCount}
                    onChange={(e) => setFilters({ ...filters, minCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Count
                  </label>
                  <input
                    type="number"
                    value={filters.maxCount}
                    onChange={(e) => setFilters({ ...filters, maxCount: parseInt(e.target.value) || 1000 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Charts */}
        {showCharts && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">
              Data Distribution Charts
            </h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-700 mb-4">Top 10 Distribution</h4>
                <BarPlot
                  data={getBarChartData()}
                  height={400}
                  title=""
                />
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-700 mb-4">Pie Chart View</h4>
                <CiliaMinerPieChart
                  data={getPieChartData()}
                  height={400}
                  title=""
                />
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              {[
                { id: 'genes', name: 'Genes', count: filteredData.genes.length, icon: Database },
                { id: 'features', name: 'Clinical Features', count: filteredData.features.length, icon: Eye },
                { id: 'orthologs', name: 'Orthologs', count: filteredData.orthologs.length, icon: Activity }
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.name} ({tab.count})
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Table Controls */}
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, (filteredData[activeTab] || []).length)} of {(filteredData[activeTab] || []).length} results
            </div>
            <button
              onClick={() => handleDownload(filteredData[activeTab] || [], `ciliaminer_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`)}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'genes' && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Human Gene Name')}>
                        <div className="flex items-center gap-2">
                          Gene Name
                          {getSortIcon('Human Gene Name')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Human Gene ID')}>
                        <div className="flex items-center gap-2">
                          Gene ID
                          {getSortIcon('Human Gene ID')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Ciliopathy')}>
                        <div className="flex items-center gap-2">
                          Ciliopathy
                          {getSortIcon('Ciliopathy')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Subcellular Localization')}>
                        <div className="flex items-center gap-2">
                          Localization
                          {getSortIcon('Subcellular Localization')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                                         {(getCurrentData() as CiliopathyGene[]).map((gene, index) => (
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
              )}

              {activeTab === 'features' && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Disease')}>
                        <div className="flex items-center gap-2">
                          Disease
                          {getSortIcon('Disease')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Category')}>
                        <div className="flex items-center gap-2">
                          Category
                          {getSortIcon('Category')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Feature')}>
                        <div className="flex items-center gap-2">
                          Feature
                          {getSortIcon('Feature')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Count')}>
                        <div className="flex items-center gap-2">
                          Count
                          {getSortIcon('Count')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                                         {(getCurrentData() as CiliopathyFeature[]).map((feature, index) => (
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
              )}

              {activeTab === 'orthologs' && (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Human Gene')}>
                        <div className="flex items-center gap-2">
                          Human Gene
                          {getSortIcon('Human Gene')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Human Disease')}>
                        <div className="flex items-center gap-2">
                          Human Disease
                          {getSortIcon('Human Disease')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Ortholog Gene')}>
                        <div className="flex items-center gap-2">
                          Ortholog Gene
                          {getSortIcon('Ortholog Gene')}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('Organism')}>
                        <div className="flex items-center gap-2">
                          Organism
                          {getSortIcon('Organism')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(getCurrentData() as OrthologGene[]).map((ortholog, index) => (
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
              )}
            </div>
          )}

          {/* Pagination */}
          {getTotalPages() > 1 && (
            <div className="mt-6 flex justify-center">
              <nav className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, getTotalPages()) }, (_, i) => {
                  const page = Math.max(1, Math.min(getTotalPages() - 4, currentPage - 2)) + i
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 border text-sm font-medium rounded-md ${
                        page === currentPage
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  )
                })}
                
                <button
                  onClick={() => setCurrentPage(Math.min(getTotalPages(), currentPage + 1))}
                  disabled={currentPage === getTotalPages()}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
