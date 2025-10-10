'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { OrthologGene } from '@/types'
import { Search, Download, Database, Eye, Bug } from 'lucide-react'

export default function DrosophilaMelanogasterPage() {
  const [orthologs, setOrthologs] = useState<OrthologGene[]>([])
  const [filteredOrthologs, setFilteredOrthologs] = useState<OrthologGene[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDisease, setSelectedDisease] = useState('All')
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    totalOrthologs: 0,
    totalDiseases: 0,
    totalGenes: 0
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterOrthologs()
  }, [searchQuery, selectedDisease, orthologs])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const orthologsData = await dataService.getOrthologData('drosophila_melanogaster')
      setOrthologs(orthologsData)
      setFilteredOrthologs(orthologsData)
      
      const uniqueDiseases = new Set(orthologsData.map(o => o['Human Disease']))
      const uniqueGenes = new Set(orthologsData.map(o => o['Ortholog Gene']))
      
      setStats({
        totalOrthologs: orthologsData.length,
        totalDiseases: uniqueDiseases.size,
        totalGenes: uniqueGenes.size
      })
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterOrthologs = () => {
    let filtered = orthologs

    if (searchQuery) {
      filtered = filtered.filter(ortholog => 
        ortholog['Human Gene']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ortholog['Ortholog Gene']?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ortholog['Human Disease']?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (selectedDisease !== 'All') {
      filtered = filtered.filter(ortholog => ortholog['Human Disease'] === selectedDisease)
    }

    setFilteredOrthologs(filtered)
  }

  const getDiseaseList = () => {
    const uniqueDiseases = Array.from(new Set(orthologs.map(o => o['Human Disease'])))
    return ['All', ...uniqueDiseases.sort()]
  }

  const handleDownload = () => {
    if (filteredOrthologs.length === 0) return
    
    const csvContent = [
      ['Human Gene', 'Human Gene ID', 'Human Disease', 'Human Disease MIM', 'Ortholog Gene', 'Ortholog Gene ID', 'Ortholog Disease', 'Organism'],
      ...filteredOrthologs.map(ortholog => [
        ortholog['Human Gene'] || '',
        ortholog['Human Gene ID'] || '',
        ortholog['Human Disease'] || '',
        ortholog['Human Disease MIM'] || '',
        ortholog['Ortholog Gene'] || '',
        ortholog['Ortholog Gene ID'] || '',
        ortholog['Ortholog Disease'] || '',
        ortholog.Organism || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ciliaminer_drosophila_melanogaster_orthologs_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Drosophila melanogaster
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            This page lists fruit fly ciliopathy genes which are orthologs with human genes.
            The Disease/Gene Reference column in the table offers a PubMed ID relating to associated diseases and genes, 
            whilst the ciliary localization column displays data from mammalian and worm studies.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Database className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalOrthologs}</h3>
            <p className="text-gray-600">Total Orthologs</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Eye className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalDiseases}</h3>
            <p className="text-gray-600">Diseases</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6 text-center">
            <Bug className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-800">{stats.totalGenes}</h3>
            <p className="text-gray-600">Fruit Fly Genes</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search Orthologs
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by gene name, disease, or ortholog..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Disease
              </label>
              <select
                value={selectedDisease}
                onChange={(e) => setSelectedDisease(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              >
                {getDiseaseList().map(disease => (
                  <option key={disease} value={disease}>
                    {disease}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Fruit Fly Orthologs ({filteredOrthologs.length} found)
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
              <p className="text-gray-600">Loading fruit fly ortholog data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Human Gene</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Human Gene ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Human Disease</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fruit Fly Gene</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fruit Fly Gene ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fruit Fly Disease</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organism</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrthologs.slice(0, 100).map((ortholog, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ortholog['Human Gene']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ortholog['Human Gene ID']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ortholog['Human Disease']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {ortholog['Ortholog Gene']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ortholog['Ortholog Gene ID']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ortholog['Ortholog Disease']}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ortholog.Organism}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredOrthologs.length > 100 && (
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing first 100 results. Use search and filters to find specific orthologs.
            </div>
          )}
        </div>

        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            About Fruit Fly Ciliopathy Orthologs
          </h3>
          <div className="text-blue-700 space-y-2">
            <p>
              Drosophila melanogaster (fruit fly) is a powerful model organism for studying ciliopathies due to its 
              short generation time, genetic tractability, and conserved cellular processes.
            </p>
            <p>
              Fruit fly orthologs provide insights into fundamental ciliary mechanisms and disease pathways.
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
