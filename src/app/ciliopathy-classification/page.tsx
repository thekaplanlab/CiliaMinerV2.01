'use client'

import React, { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { dataService } from '@/services/dataService'
import { CiliopathyGene, CiliopathyFeature, HeatmapData } from '@/types'
import { DiseaseFeatureHeatmap } from '@/components/HeatmapChart'
import { 
  Database, 
  AlertTriangle, 
  Activity, 
  Zap, 
  Eye, 
  Brain, 
  Heart, 
  CircleDot,
  ActivitySquare,
  Ear,
  Baby,
  Cog,
  Search,
  Download
} from 'lucide-react'

interface SymptomSummary {
  category: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  color: string
}

const symptomCategories: SymptomSummary[] = [
  { category: 'Aural', count: 0, icon: Ear, color: 'bg-blue-500' },
  { category: 'Neural', count: 0, icon: Brain, color: 'bg-purple-500' },
  { category: 'Ophthalmic', count: 0, icon: Eye, color: 'bg-green-500' },
  { category: 'Skeletal', count: 0, icon: Activity, color: 'bg-yellow-500' },
  { category: 'Respiratory', count: 0, icon: Activity, color: 'bg-red-500' },
  { category: 'Hormonal', count: 0, icon: Zap, color: 'bg-pink-500' },
  { category: 'Reproductive', count: 0, icon: Baby, color: 'bg-indigo-500' },
  { category: 'Facial', count: 0, icon: Cog, color: 'bg-orange-500' },
  { category: 'Cerebral', count: 0, icon: Brain, color: 'bg-gray-500' },
  { category: 'Renal', count: 0, icon: CircleDot, color: 'bg-teal-500' },
  { category: 'Coronary', count: 0, icon: Heart, color: 'bg-rose-500' },
  { category: 'Nasal', count: 0, icon: Cog, color: 'bg-cyan-500' },
  { category: 'Liver', count: 0, icon: CircleDot, color: 'bg-emerald-500' },
  { category: 'Cognitive', count: 0, icon: Brain, color: 'bg-violet-500' },
  { category: 'Digestive', count: 0, icon: Cog, color: 'bg-amber-500' },
  { category: 'Organ', count: 0, icon: Cog, color: 'bg-slate-500' }
]

export default function CiliopathyClassificationPage() {
  const [activeTab, setActiveTab] = useState('primary')
  const [selectedCiliopathy, setSelectedCiliopathy] = useState('All')
  const [selectedHeatmapCiliopathies, setSelectedHeatmapCiliopathies] = useState<string[]>([])
  const [genes, setGenes] = useState<CiliopathyGene[]>([])
  const [features, setFeatures] = useState<CiliopathyFeature[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [symptomCounts, setSymptomCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    loadData()
  }, [activeTab])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [genesData, featuresData, heatmapData] = await Promise.all([
        dataService.getCiliopathyGenes(),
        dataService.getCiliopathyFeatures(),
        dataService.getSymptomsData()
      ])
      
      setGenes(genesData)
      setFeatures(featuresData)
      setHeatmapData(heatmapData)
      calculateSymptomCounts(featuresData)
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateSymptomCounts = (featuresData: CiliopathyFeature[]) => {
    const counts: Record<string, number> = {}
    symptomCategories.forEach(cat => {
      // Map category names to match the data structure
      const categoryMapping: Record<string, string[]> = {
        'Aural': ['Auditory', 'Hearing', 'Ear'],
        'Neural': ['Neurological', 'Cerebral', 'Brain'],
        'Ophthalmic': ['Ocular', 'Eye', 'Visual', 'Retinal'],
        'Skeletal': ['Bone', 'Skeletal', 'Osteo'],
        'Respiratory': ['Respiratory', 'Lung', 'Pulmonary'],
        'Hormonal': ['Endocrine', 'Hormonal', 'Metabolic'],
        'Reproductive': ['Reproductive', 'Genital', 'Fertility'],
        'Facial': ['Facial', 'Cranio', 'Cephalo'],
        'Cerebral': ['Cerebral', 'Neurological', 'Brain'],
        'Renal': ['Renal', 'Kidney', 'Nephro'],
        'Coronary': ['Coronary', 'Cardiac', 'Heart', 'Vascular'],
        'Nasal': ['Nasal', 'Sinus', 'Respiratory'],
        'Liver': ['Hepatic', 'Liver', 'Biliary'],
        'Cognitive': ['Cognitive', 'Mental', 'Intellectual'],
        'Digestive': ['Digestive', 'Gastro', 'Intestinal'],
        'Organ': ['Organ', 'Systemic', 'General']
      }
      
      const searchTerms = categoryMapping[cat.category] || [cat.category]
      counts[cat.category] = featuresData.filter(f => 
        searchTerms.some(term => 
          f.Category?.toLowerCase().includes(term.toLowerCase()) ||
          f['General Titles']?.toLowerCase().includes(term.toLowerCase())
        )
      ).length
    })
    setSymptomCounts(counts)
  }

  const getFilteredGenes = () => {
    if (selectedCiliopathy === 'All') return genes
    return genes.filter(gene => gene.Ciliopathy === selectedCiliopathy)
  }

  const getCiliopathyList = () => {
    const uniqueCiliopathies = Array.from(new Set(genes.map(g => g.Ciliopathy)))
    return ['All', ...uniqueCiliopathies.sort()]
  }

  const handleSelectAll = () => {
    const allCiliopathies = getCiliopathyList().filter(c => c !== 'All')
    setSelectedHeatmapCiliopathies(allCiliopathies)
  }

  const handleClearAll = () => {
    setSelectedHeatmapCiliopathies([])
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

  // Helper function to create Ensembl link for Gene ID
  const createEnsemblLink = (geneId: string, geneName: string) => {
    if (!geneId || geneId === '-') return <span className="text-center">-</span>
    const geneIdStr = String(geneId)
    
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

  // Helper function to create OMIM link
  const createOMIMLink = (mimNumber: string) => {
    if (!mimNumber || mimNumber === '-') return <span className="text-center">-</span>
    const cleanNumber = mimNumber.replace(/[^\d]/g, '')
    if (!cleanNumber) return <span className="text-center">{mimNumber}</span>
    
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

  // Helper function to create PubMed links for references
  const createPubMedLinks = (references: string) => {
    if (!references || references === '-') return <span className="text-center">-</span>
    
    // Split by comma or semicolon and process each reference
    const refList = references.split(/[,;]/).map(ref => ref.trim()).filter(ref => ref)
    
    return (
      <div className="flex flex-wrap gap-1 justify-center">
        {refList.map((ref, idx) => {
          const cleanRef = ref.replace(/[^\d]/g, '')
          if (!cleanRef) return <span key={idx}>{ref}{idx < refList.length - 1 ? ', ' : ''}</span>
          
          return (
            <React.Fragment key={idx}>
              <a 
                href={`https://pubmed.ncbi.nlm.nih.gov/${cleanRef}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
              >
                {ref}
              </a>
              {idx < refList.length - 1 && <span>, </span>}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  const tabs = [
    { id: 'primary', name: 'Primary Ciliopathies', icon: Database, description: 'This website contains a list of human genes for primary ciliopathies. The localization of protein products of disease-associated genes, articles, and disease/gene-related extensions are given.' },
    { id: 'secondary', name: 'Secondary Ciliopathies', icon: AlertTriangle, description: 'This website contains a list of human genes for secondary diseases. The localization of protein products of disease-associated genes, articles, and disease/gene-related extensions are given.' },
    { id: 'motile', name: 'Motile Ciliopathies', icon: Activity, description: 'This website lists human genes of motile ciliopathies. The localization of protein products of disease-associated genes, articles, and disease/gene-related extensions are given.' },
    { id: 'atypical', name: 'Atypical Ciliopathies', icon: Zap, description: 'Unclassified ciliopathy disease-related genes have been collected on this page using the search term "ciliopathy".' },
    { id: 'potential', name: 'Potential Ciliopathy Genes', icon: Eye, description: 'The list of candidate ciliopathy genes in this subtab includes genes that are primarily found in the cilia as well as genes that are associated with the formation and maintenance of cilia.' }
  ]

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Ciliopathy Classification
          </h1>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            Explore different types of ciliopathies and their associated genes, symptoms, and clinical features.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {tabs.map((tab) => (
              <div key={tab.id} className={activeTab === tab.id ? 'block' : 'hidden'}>
                <div className="mb-6">
                  <p className="text-gray-600">{tab.description}</p>
                </div>

                {/* Controls */}
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Choose a {tab.name.toLowerCase().replace(' ciliopathies', '')} ciliopathy
                    </label>
                    <select
                      value={selectedCiliopathy}
                      onChange={(e) => setSelectedCiliopathy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    >
                      {getCiliopathyList().map(ciliopathy => (
                        <option key={ciliopathy} value={ciliopathy}>
                          {ciliopathy}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Choose ciliopathies for heatmap
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSelectAll}
                        className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                      >
                        All
                      </button>
                      <button
                        onClick={handleClearAll}
                        className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Disease Symptom Summary */}
                <div className="mb-8">
                  <h3 className="text-2xl font-semibold text-center text-primary mb-6">
                    Disease Symptom Summary
                  </h3>
                  <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                    {symptomCategories.map((category) => {
                      const Icon = category.icon
                      return (
                        <div key={category.category} className="text-center">
                          <div className={`${category.color} w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-2`}>
                            <Icon className="h-6 w-6 text-white" />
                          </div>
                          <p className="text-xs font-medium text-gray-700">{category.category}</p>
                          <p className="text-lg font-bold text-primary">{symptomCounts[category.category] || 0}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Results Table */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-semibold text-gray-800">
                      Genes ({getFilteredGenes().length} found)
                    </h3>
                    <button
                      onClick={() => handleDownload(getFilteredGenes(), `ciliaminer_${tab.id}_genes.csv`)}
                      className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Download CSV
                    </button>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading data...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Gene Name</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Gene ID</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Ciliopathy</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Localization</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">MIM Number</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">References</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getFilteredGenes().slice(0, 50).map((gene, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                                {gene['Human Gene Name']}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900">
                                {createEnsemblLink(gene['Human Gene ID'] || '-', gene['Human Gene Name'])}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900">
                                {gene.Ciliopathy}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900">
                                {gene['Subcellular Localization']}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900">
                                {createOMIMLink(gene['Gene MIM Number'] || '-')}
                              </td>
                              <td className="px-6 py-4 text-center text-sm text-gray-900">
                                {createPubMedLinks(gene['Disease/Gene Reference'] || '-')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Heatmap */}
                {heatmapData.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold text-gray-800 mb-4">
                      Disease vs. Clinical Features Heatmap
                    </h3>
                    <div className="bg-white rounded-lg border">
                      <DiseaseFeatureHeatmap
                        data={heatmapData}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    The Disease/Gene Reference column in the table offers a PubMed ID relating to associated diseases and genes, 
                    whilst the ciliary localization column displays data from mammalian and worm studies.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  )
}
