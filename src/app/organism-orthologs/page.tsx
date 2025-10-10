'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import { AdvancedSearch } from '@/components/AdvancedSearch'
import { EnhancedDataTable } from '@/components/EnhancedDataTable'
import { GeneLocalizationHeatmap } from '@/components/HeatmapChart'
import { BarPlot, StatCard } from '@/components/ChartComponents'
import { SearchFilters, OrthologGene, HeatmapData } from '@/types'
import { dataService } from '@/services/dataService'
import { 
  Mouse, 
  Fish, 
  Zap, 
  Bug, 
  Circle, 
  Leaf,
  Database,
  TrendingUp,
  Activity,
  Globe,
  Search,
  Download
} from 'lucide-react'

export default function OrganismOrthologsPage() {
  const [selectedOrganism, setSelectedOrganism] = useState('mus_musculus')
  const [orthologData, setOrthologData] = useState<OrthologGene[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<OrthologGene[]>([])
  const [realData, setRealData] = useState<{
    orthologs: OrthologGene[]
    localizationData: HeatmapData[]
    organismStats: { [key: string]: { geneCount: number; orthologCount: number } }
  }>({
    orthologs: [],
    localizationData: [],
    organismStats: {}
  })

  // Organism configurations
  const organisms = [
    {
      id: 'mus_musculus',
      name: 'Mus musculus (Mouse)',
      icon: Mouse,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      description: 'Primary mammalian model organism for ciliopathy research'
    },
    {
      id: 'danio_rerio',
      name: 'Danio rerio (Zebrafish)',
      icon: Fish,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      description: 'Aquatic model for developmental and ciliary studies'
    },
    {
      id: 'xenopus_laevis',
      name: 'Xenopus laevis (Frog)',
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      description: 'Amphibian model for ciliary development research'
    },
    {
      id: 'drosophila_melanogaster',
      name: 'Drosophila melanogaster (Fruit Fly)',
      icon: Bug,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      description: 'Invertebrate model for ciliary function studies'
    },
    {
      id: 'caenorhabditis_elegans',
      name: 'Caenorhabditis elegans (Worm)',
      icon: Circle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      description: 'Nematode model for ciliary genetics research'
    },
    {
      id: 'chlamydomonas_reinhardtii',
      name: 'Chlamydomonas reinhardtii (Algae)',
      icon: Leaf,
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      description: 'Unicellular model for ciliary motility studies'
    }
  ]

  // Load real data on component mount
  useEffect(() => {
    loadRealData()
  }, [])

  // Load data when organism changes
  useEffect(() => {
    if (selectedOrganism) {
      loadOrganismData(selectedOrganism)
    }
  }, [selectedOrganism])

  const loadRealData = async () => {
    try {
      setIsLoading(true)
      
      // Load localization data for heatmap
      const localizationData = await dataService.getGeneLocalizationData()
      
      // Load stats for all organisms
      const organismStats: { [key: string]: { geneCount: number; orthologCount: number } } = {}
      
      for (const organism of organisms) {
        try {
          const stats = await dataService.getOrganismStats(organism.id)
          organismStats[organism.id] = stats
        } catch (error) {
          console.error(`Failed to load stats for ${organism.id}:`, error)
          organismStats[organism.id] = { geneCount: 0, orthologCount: 0 }
        }
      }

      setRealData({
        orthologs: [],
        localizationData,
        organismStats
      })

    } catch (error) {
      console.error('Failed to load real data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOrganismData = async (organismId: string) => {
    try {
      setIsLoading(true)
      const orthologs = await dataService.getOrthologData(organismId)
      setOrthologData(orthologs)
    } catch (error) {
      console.error(`Failed to load data for ${organismId}:`, error)
      setOrthologData([])
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate ortholog distribution from real data
  const orthologDistributionData = useMemo(() => {
    const stats = realData.organismStats
    if (!stats || Object.keys(stats).length === 0) {
      return []
    }
    
    // Color mapping for organisms
    const colorMap: { [key: string]: string } = {
      'mus_musculus': '#3B82F6',
      'danio_rerio': '#10B981',
      'xenopus_laevis': '#8B5CF6',
      'drosophila_melanogaster': '#F59E0B',
      'caenorhabditis_elegans': '#EF4444',
      'chlamydomonas_reinhardtii': '#14B8A6'
    }
    
    return organisms.map(org => ({
      name: org.name.split('(')[0].trim(), // Get just the organism name without the description
      value: stats[org.id]?.orthologCount || 0,
      color: colorMap[org.id] || '#6B7280'
    })).filter(item => item.value > 0) // Only show organisms with data
  }, [realData.organismStats])

  const handleSearch = async (query: string, filters: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsLoading(true)
    try {
      // Filter current ortholog data based on query and filters
      let filtered = orthologData.filter(result => 
        result['Human Gene Name'].toLowerCase().includes(query.toLowerCase()) ||
        result['Ortholog Gene Name'].toLowerCase().includes(query.toLowerCase()) ||
        result['Human Disease'].toLowerCase().includes(query.toLowerCase())
      )
      
      if (filters.organism && filters.organism !== '') {
        filtered = filtered.filter(result => 
          result.Organism.toLowerCase().includes(filters.organism!.toLowerCase())
        )
      }
      
      setSearchResults(filtered)
    } catch (error) {
      console.error('Search failed:', error)
      setSearchResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleOrganismChange = (organismId: string) => {
    setSelectedOrganism(organismId)
    setSearchResults([]) // Clear previous search results
  }

  const tableColumns = [
    { key: 'Human Gene Name', label: 'Human Gene', sortable: true, filterable: true },
    { key: 'Human Disease', label: 'Human Disease', sortable: true, filterable: true },
    { key: 'Ortholog Gene Name', label: 'Ortholog Gene', sortable: true, filterable: true },
    { key: 'Organism', label: 'Organism', sortable: true, filterable: true },
    { key: 'Sequence Identity', label: 'Sequence Identity (%)', sortable: true, filterable: false },
    { key: 'Functional Conservation', label: 'Conservation', sortable: true, filterable: true }
  ]

  const currentOrganism = organisms.find(o => o.id === selectedOrganism)
  const currentStats = realData.organismStats[selectedOrganism] || { geneCount: 0, orthologCount: 0 }

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="container mx-auto px-6 py-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Organism-Specific Ortholog Analysis
            </h1>
            <p className="text-lg text-gray-600 max-w-4xl">
              Explore ortholog relationships between human ciliopathy genes and their counterparts 
              in model organisms. Analyze sequence conservation, functional relationships, and 
              disease associations across species.
            </p>
          </div>
        </div>

        <div className="container mx-auto px-6 py-8">
          {/* Organism Selection */}
          <section className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Select Model Organism
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {organisms.map((organism) => {
                  const stats = realData.organismStats[organism.id] || { geneCount: 0, orthologCount: 0 }
                  return (
                    <button
                      key={organism.id}
                      onClick={() => handleOrganismChange(organism.id)}
                      className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                        selectedOrganism === organism.id
                          ? 'border-primary bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center mb-3">
                        <organism.icon className={`h-6 w-6 mr-3 ${organism.color}`} />
                        <h3 className="font-semibold text-gray-900">{organism.name}</h3>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{organism.description}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Genes: {stats.geneCount}</span>
                        <span className="text-gray-600">Orthologs: {stats.orthologCount}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Current Organism Overview */}
          {currentOrganism && (
            <section className="mb-8">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center mb-6">
                  <div className={`p-3 rounded-lg ${currentOrganism.bgColor} mr-4`}>
                    <currentOrganism.icon className={`h-8 w-8 ${currentOrganism.color}`} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {currentOrganism.name}
                    </h2>
                    <p className="text-gray-600">{currentOrganism.description}</p>
                  </div>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard
                    title="Total Genes"
                    value={currentStats.geneCount.toString()}
                    icon={Database}
                    color="blue"
                  />
                  <StatCard
                    title="Orthologs"
                    value={currentStats.orthologCount.toString()}
                    icon={TrendingUp}
                    color="green"
                  />
                  <StatCard
                    title="High Conservation"
                    value="65%"
                    icon={Activity}
                    color="purple"
                  />
                  <StatCard
                    title="Publications"
                    value="200+"
                    icon={Globe}
                    color="orange"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Search Section */}
          <section className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Search Orthologs
              </h2>
              <AdvancedSearch
                onSearch={handleSearch}
                searchType="ortholog"
                placeholder="Search by gene name, disease, or organism..."
                className="mb-4"
              />
            </div>
          </section>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <section className="mb-8">
              <EnhancedDataTable
                data={searchResults}
                columns={tableColumns}
                title={`Ortholog Search Results (${searchResults.length} found)`}
                pageSize={15}
              />
            </section>
          )}

          {/* Visualizations Grid */}
          <section className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Ortholog Distribution */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ortholog Distribution by Organism
                </h3>
                {isLoading || orthologDistributionData.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <BarPlot
                    data={orthologDistributionData}
                    dataKey="value"
                    nameKey="name"
                    height={300}
                    colors={orthologDistributionData.map(d => d.color)}
                  />
                )}
              </div>

              {/* Gene Localization Heatmap */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Gene vs. Localization Heatmap
                </h3>
                {isLoading || realData.localizationData.length === 0 ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <GeneLocalizationHeatmap
                    data={realData.localizationData.slice(0, 100)} // Limit for performance
                    className="h-[300px]"
                  />
                )}
              </div>
            </div>
          </section>

          {/* Current Organism Data */}
          {orthologData.length > 0 && (
            <section className="mb-8">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {currentOrganism?.name} Orthologs ({orthologData.length})
                  </h3>
                  <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
                    <Download className="h-4 w-4" />
                    Export Data
                  </button>
                </div>
                <EnhancedDataTable
                  data={orthologData}
                  columns={tableColumns}
                  pageSize={10}
                />
              </div>
            </section>
          )}

          {/* Research Applications */}
          <section className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">
                Research Applications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Functional Studies</h3>
                  <p className="text-sm text-gray-600">
                    Use orthologs to study gene function in tractable model systems
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Drug Screening</h3>
                  <p className="text-sm text-gray-600">
                    Identify therapeutic compounds using high-throughput assays
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Disease Modeling</h3>
                  <p className="text-sm text-gray-600">
                    Create animal models to study disease mechanisms and progression
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Evolutionary Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Study conservation patterns across species and time
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Pathway Analysis</h3>
                  <p className="text-sm text-gray-600">
                    Understand cellular pathways and regulatory networks
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Comparative Genomics</h3>
                  <p className="text-sm text-gray-600">
                    Analyze genomic structure and organization across species
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Information Section */}
          <section className="mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                About Ortholog Analysis
              </h2>
              <div className="prose max-w-none text-gray-700">
                <p className="mb-4">
                  Orthologs are genes in different species that evolved from a common ancestral 
                  gene through speciation. Studying orthologs helps researchers:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Understand gene function:</strong> Model organisms often provide 
                    more tractable systems for functional studies than human cells or tissues.
                  </li>
                  <li>
                    <strong>Model human diseases:</strong> Many ciliopathies can be modeled 
                    in organisms like mice, zebrafish, or fruit flies.
                  </li>
                  <li>
                    <strong>Identify therapeutic targets:</strong> Conservation of function 
                    across species suggests important biological roles and potential drug targets.
                  </li>
                  <li>
                    <strong>Study evolutionary conservation:</strong> Highly conserved genes 
                    often have essential functions in development and physiology.
                  </li>
                </ul>
                <p className="mt-4 text-sm text-gray-600">
                  Current database contains ortholog data for {organisms.length} model organisms, 
                  with {Object.values(realData.organismStats).reduce((sum, stats) => sum + stats.orthologCount, 0)} 
                  total ortholog relationships.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}
