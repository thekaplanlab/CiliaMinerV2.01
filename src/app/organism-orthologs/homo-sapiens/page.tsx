'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { CiliopathyGene } from '@/types'
import { Search, Download, MapPin, Database, Eye, Brain, Heart } from 'lucide-react'

export default function HomoSapiensPage() {
  const [genes, setGenes] = useState<CiliopathyGene[]>([])
  const [filteredGenes, setFilteredGenes] = useState<CiliopathyGene[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCiliopathy, setSelectedCiliopathy] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalGenes: 0,
    totalCiliopathies: 0,
    totalLocalizations: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterGenes()
  }, [searchQuery, selectedCiliopathy, genes])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const genesData = await dataService.getCiliopathyGenes()
      setGenes(genesData)
      setFilteredGenes(genesData)
      
      // Calculate statistics
      const uniqueCiliopathies = new Set(genesData.map(g => g.Ciliopathy))
      const uniqueLocalizations = new Set(genesData.map(g => g['Subcellular Localization']))
      
      setStats({
        totalGenes: genesData.length,
        totalCiliopathies: uniqueCiliopathies.size,
        totalLocalizations: uniqueLocalizations.size
      })
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterGenes = () => {
    let filtered = genes

    if (searchQuery) {
      filtered = filtered.filter(gene => 
        gene['Human Gene Name']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gene['Human Gene ID']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        gene.Ciliopathy?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedCiliopathy !== 'All') {
      filtered = filtered.filter(gene => gene.Ciliopathy === selectedCiliopathy)
    }

    setFilteredGenes(filtered)
  }

  const getCiliopathyList = () => {
    const uniqueCiliopathies = Array.from(new Set(genes.map(g => g.Ciliopathy)))
    return ['All', ...uniqueCiliopathies.sort()]
  }

  const handleDownload = () => {
    if (filteredGenes.length === 0) return
    
    const csvContent = [
      ['Gene Name', 'Gene ID', 'Ciliopathy', 'Subcellular Localization', 'MIM Number', 'OMIM Phenotype', 'References', 'Localization Reference'],
      ...filteredGenes.map(gene => [
        gene['Human Gene Name'] || '',
        gene['Human Gene ID'] || '',
        gene.Ciliopathy || '',
        gene['Subcellular Localization'] || '',
        gene['Gene MIM Number'] || '',
        gene['OMIM Phenotype Number'] || '',
        gene['Disease/Gene Reference'] || '',
        gene['Localisation Reference'] || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ciliaminer_homo_sapiens_genes_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Homo sapiens
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            This page lists all human genes based on both pure and secondary ciliopathies with localization references.
            The Disease/Gene Reference column in the table offers a PubMed ID relating to associated diseases and genes, 
            whilst the ciliary localization column displays data from mammalian and worm studies.
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Database className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalGenes}</h3>
            <p className="text-gray-600">Total Genes</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Eye className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalCiliopathies}</h3>
            <p className="text-gray-600">Ciliopathies</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <MapPin className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalLocalizations}</h3>
            <p className="text-gray-600">Localizations</p>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Genes
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by gene name, ID, or ciliopathy..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Ciliopathy
              </label>
              <select
                value={selectedCiliopathy}
                onChange={(e) => setSelectedCiliopathy(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {getCiliopathyList().map(ciliopathy => (
                  <option key={ciliopathy} value={ciliopathy}>
                    {ciliopathy}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Genes ({filteredGenes.length} found)
            </h2>
            <button
              onClick={handleDownload}
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download CSV
            </button>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-gray-600">Loading human genes data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gene Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gene ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ciliopathy</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subcellular Localization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MIM Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">OMIM Phenotype</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Disease/Gene Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Localization Reference</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGenes.slice(0, 100).map((gene, index) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {gene['Gene MIM Number']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {gene['OMIM Phenotype Number']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {gene['Disease/Gene Reference']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {gene['Localisation Reference']}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Info */}
          {filteredGenes.length > 100 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing first 100 results. Use search and filters to find specific genes.
            </div>
          )}
        </div>

        {/* Additional Information */}
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            About Human Ciliopathy Genes
          </h3>
          <div className="text-blue-700 space-y-2">
            <p>
              Human ciliopathy genes are associated with various genetic disorders affecting cilia structure and function. 
              These genes play crucial roles in ciliary assembly, maintenance, and signaling pathways.
            </p>
            <p>
              The subcellular localization data provides insights into where these proteins function within the cell, 
              helping researchers understand disease mechanisms and develop targeted therapies.
            </p>
            <p>
              <strong>Note:</strong> Some localization data may be uncertain and is marked with an asterisk (*) 
              when derived from related research papers.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  )
}
